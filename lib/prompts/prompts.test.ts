import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import {
  registerPrompt,
  getPromptExecutor,
  getPromptContract,
  listRegisteredPrompts,
} from './registry';
import { classifyIntentContract } from './v1/classify-intent.contract';
import { respondContract } from './v1/respond.contract';
import { awaitUserContract } from './v1/await-user.contract';
import { createInitialState } from '../state/schema';
import type { AgentState } from '../state/schema';

// Mock fetch for executor tests
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

describe('Prompt System', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Re-register prompts before each test to ensure isolation
    registerPrompt(classifyIntentContract);
    registerPrompt(respondContract);
    registerPrompt(awaitUserContract);
  });

  describe('Registry', () => {
    test('registers prompts correctly', () => {
      const registered = listRegisteredPrompts();
      expect(registered).toContain('classify_intent@v1');
      expect(registered).toContain('respond@v1');
      expect(registered).toContain('await_user@v1');
    });

    test('getPromptExecutor returns a function', () => {
      const executor = getPromptExecutor('classify_intent');
      expect(typeof executor).toBe('function');
    });

    test('getPromptExecutor throws for unknown prompt', () => {
      // @ts-expect-error - testing invalid input
      expect(() => getPromptExecutor('unknown_prompt')).toThrow();
    });

    test('getPromptContract returns the contract', () => {
      const contract = getPromptContract('classify_intent');
      expect(contract.name).toBe('classify_intent');
      expect(contract.version).toBe('v1');
    });
  });

  describe('Executor', () => {
    test('classify_intent executor works end-to-end', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify(classifyIntentContract.testVectors.validOutput),
            },
          }],
        }),
      } as Response);

      const executor = getPromptExecutor('classify_intent');
      const state = createInitialState();
      state.messages.push({
        id: '1',
        role: 'user',
        content: 'What is the weather in London?',
        timestamp: new Date().toISOString(),
      });

      const update = await executor(state);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(update.context?.intent).toBe('get_weather');
      expect(update.context?.intentConfidence).toBe(0.95);
      expect(update.context?.needsIntentClassification).toBe(false);
    });

    test('executor handles LLM error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const executor = getPromptExecutor('classify_intent');
      const state = createInitialState();
      const update = await executor(state);

      expect(update.lastError).toBeDefined();
      expect(update.lastError?.message).toContain('Network error');
    });

    test('executor handles invalid output schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({ intent: 123 }), // Invalid type
            },
          }],
        }),
      } as Response);

      const executor = getPromptExecutor('classify_intent');
      const state = createInitialState();
      const update = await executor(state);

      expect(update.lastError).toBeDefined();
      expect(update.lastError?.message).toContain('Prompt execution failed');
      expect(update.lastError?.message).toContain('invalid_type');
    });
  });

  describe('Contracts', () => {
    test('classifyIntentContract derives input correctly', () => {
      const state = createInitialState();
      state.messages.push({
        id: '1', role: 'user', content: 'hello', timestamp: new Date().toISOString()
      });
      state.context.availableTools = ['search'];
      const input = classifyIntentContract.deriveInput(state);
      expect(input.lastUserMessage).toBe('hello');
      expect(input.availableTools).toEqual(['search']);
    });

    test('respondContract merges output correctly', () => {
      const state = createInitialState();
      const output = { response: 'Hello!', isTerminal: true };
      const update = respondContract.mergeOutput(output, state);
      expect(update.messages?.length).toBe(1);
      if (update.messages) {
        expect(update.messages[0].content).toBe('Hello!');
      }
      expect(update.metadata?.terminal).toBe(true);
    });

    test('awaitUserContract is a no-op merge', () => {
        const state = createInitialState();
        const update = awaitUserContract.mergeOutput({}, state);
        expect(update).toEqual(state);
    });
  });
});