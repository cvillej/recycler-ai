import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { createOrchestrator, invokeGraph } from './index';
import { HybridRouter } from '../router/hybrid';
import { registerPrompt, getPromptExecutor } from '../prompts/registry';
import { classifyIntentContract } from '../prompts/v1/classify-intent.contract';
import { respondContract } from '../prompts/v1/respond.contract';
import type { AgentState } from '../state/schema';
import { createInitialState } from '../state/schema';
import type { GraphConfig, GraphInput } from './types';

// Mock fetch for LLM calls
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

describe('LangGraph Execution Engine', () => {
  let config: GraphConfig;
  let router: HybridRouter;

  beforeEach(() => {
    mockFetch.mockClear();
    registerPrompt(classifyIntentContract);
    registerPrompt(respondContract);

    router = new HybridRouter({
      enableLLMFallback: false,
    });

    config = {
      proxyBaseURL: 'http://localhost:3000',
      llmModel: 'openai/gpt-4o',
      checkpointer: null, // MemorySaver for tests
      enableInterrupts: false,
    };
  });

  test('basic conversation flow: classify_intent → respond', async () => {
    // Mock LLM responses for prompts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              intent: 'greet',
              confidence: 0.95,
            }),
          },
        }],
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              response: 'Hello! How can I help you?',
              isTerminal: true,
            }),
          },
        }],
      }),
    } as Response);

    const input: GraphInput = {
      messages: [{ role: 'user', content: 'Hello!' }],
    };

    const orchestrator = createOrchestrator(config);
    const result = await invokeGraph(input, config);

    expect(result.finalMessage).toContain('Hello!');
    expect(result.isTerminal).toBe(true);
    expect(result.state.context.intent).toBe('greet');
    expect(result.state.routerState.phase).toBe('llm-fallback'); // From router fallback
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('interrupt handling with await_user', async () => {
    // Mock state that triggers hard rule for approval
    const input: GraphInput = {
      messages: [{ role: 'user', content: 'Approve this action?' }],
      context: { requiresApproval: true },
    };

    const configWithInterrupts: GraphConfig = {
      ...config,
      enableInterrupts: true,
    };

    const result = await invokeGraph(input, configWithInterrupts);

    // Should hit await_user interrupt
    expect(result.state.routerState.phase).toBe('hard-rule');
    expect(result.state.routerState.requiresApproval).toBe(true);
  });

  test('error handling and retry', async () => {
    // Mock LLM error in classify_intent
    mockFetch.mockRejectedValueOnce(new Error('LLM timeout'));

    const input: GraphInput = {
      messages: [{ role: 'user', content: 'Hello!' }],
    };

    const result = await invokeGraph(input, config);

    expect(result.state.lastError).toBeDefined();
    expect(result.state.lastError?.code).toBe('PROMPT_EXECUTION_FAILED');
  });

  test('checkpoint resumption', async () => {
    // First invocation
    const input1: GraphInput = {
      messages: [{ role: 'user', content: 'Hello!' }],
      threadId: 'test-thread',
    };

    const result1 = await invokeGraph(input1, config);
    expect(result1.checkpointId).toContain('test-thread');

    // Second invocation (resumes)
    const input2: GraphInput = {
      messages: [{ role: 'user', content: 'Continue' }],
      threadId: 'test-thread',
    };

    const result2 = await invokeGraph(input2, config);

    // Should have all messages from both invocations
    expect(result2.state.messages.length).toBe(2);
  });
});
