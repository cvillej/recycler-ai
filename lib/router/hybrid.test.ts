import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { HybridRouter } from './hybrid';
import { createInitialState, parseAgentState } from '../state/schema';
import type { AgentState, RouterState } from '../state/schema';
import type { RouteDecision, PromptName } from './types';

// Mock fetch globally
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

describe('HybridRouter', () => {
  let router: HybridRouter;
  let baseState: AgentState;

  beforeEach(() => {
    router = HybridRouter.create({ enableLLMFallback: false });
    baseState = createInitialState();
    mockFetch.mockClear();
  });

  describe('Hard Rules', () => {
    test('requiresApproval triggers await_user', async () => {
      const state: AgentState = {
        ...baseState,
        routerState: {
          ...baseState.routerState,
          requiresApproval: true,
        },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('await_user');
      expect(decision.source).toBe('hard_rule');
      expect(decision.reason).toContain('requires human approval');
      // routerState is updated in place
      expect(state.routerState.phase).toBe('hard-rule');
      expect(state.routerState.lastDecision?.ruleId).toBe(decision.nextPrompt);
    });

    test('retry limit exceeded triggers handle_error', async () => {
      const state: AgentState = {
        ...baseState,
        lastError: {
          message: 'Network timeout',
          code: 'NETWORK_ERR',
          timestamp: new Date().toISOString(),
        },
        metadata: { retryCount: 3 },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('handle_error');
      expect(decision.source).toBe('hard_rule');
      expect(decision.reason).toContain('Retry limit exceeded');
    });

    test('terminal state triggers respond', async () => {
      const state: AgentState = {
        ...baseState,
        metadata: { terminal: true },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('respond');
      expect(decision.source).toBe('hard_rule');
      expect(decision.reason).toContain('terminal state');
    });
  });

  describe('State Rules', () => {
    test('needsIntentClassification triggers classify_intent', async () => {
      const state: AgentState = {
        ...baseState,
        context: { needsIntentClassification: true },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('classify_intent');
      expect(decision.source).toBe('state_based');
      expect(decision.reason).toContain('intent classification');
    });

    test('focus data_query without queryPlan triggers plan_query', async () => {
      const state: AgentState = {
        ...baseState,
        context: { focus: 'data_query' },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('plan_query');
      expect(decision.source).toBe('state_based');
      expect(decision.reason).toContain('data_query');
    });

    test('queryPlan without toolResults triggers execute_tool_reasoning', async () => {
      const state: AgentState = {
        ...baseState,
        context: { queryPlan: 'SELECT * FROM users' },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('execute_tool_reasoning');
      expect(decision.source).toBe('state_based');
      expect(decision.reason).toContain('tool execution');
    });

    test('toolResults without analysis triggers analyze_results', async () => {
      const state: AgentState = {
        ...baseState,
        context: { toolResults: [{ id: 1, name: 'test' }] },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('analyze_results');
      expect(decision.source).toBe('state_based');
      expect(decision.reason).toContain('Tool results available');
    });

    test('readyToRespond triggers respond', async () => {
      const state: AgentState = {
        ...baseState,
        context: { readyToRespond: true },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('respond');
      expect(decision.source).toBe('state_based');
      expect(decision.reason).toContain('ready to formulate');
    });

    test('pivotSignals triggers classify_intent', async () => {
      const state: AgentState = {
        ...baseState,
        routerState: {
          ...baseState.routerState,
          pivotSignals: ['userChangedTopic'],
        },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('classify_intent');
      expect(decision.source).toBe('state_based');
      expect(decision.reason).toContain('Pivot signals');
    });
  });

  describe('Custom Rules (Extensibility)', () => {
    test('custom rule can override state rules', async () => {
      router.registerCustomRule((state: AgentState) => {
        if (state.context.customFlag === true) {
          return {
            nextPrompt: 'respond',
            source: 'state_based',
            reason: 'Custom rule matched',
          };
        }
        return null;
      });

      const state: AgentState = {
        ...baseState,
        context: { customFlag: true },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('respond');
      expect(decision.reason).toContain('Custom rule');
    });

    test('custom rule returns null when no match', async () => {
      router.registerCustomRule(() => null);
      // No rules match, LLM fallback disabled → should throw
      await expect(router.selectNextPrompt(baseState)).rejects.toThrow(
        'LLM fallback is disabled but no rule matched'
      );
    });
  });

  describe('LLM Fallback', () => {
    let llmRouter: HybridRouter;

    beforeEach(() => {
      llmRouter = HybridRouter.create({ enableLLMFallback: true });
    });

    test('LLM fallback returns valid prompt when no rules match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                nextPrompt: 'classify_intent',
                reason: 'User intent unclear',
              }),
            },
          }],
        }),
      } as Response);

      const decision = await llmRouter.selectNextPrompt(baseState);
      expect(decision.nextPrompt).toBe('classify_intent');
      expect(decision.source).toBe('llm_fallback');
      expect(decision.reason).toContain('LLM fallback');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('LLM fallback validates whitelist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                nextPrompt: 'invalid_prompt',
                reason: 'test',
              }),
            },
          }],
        }),
      } as Response);

      const decision = await llmRouter.selectNextPrompt(baseState);
      // Should fallback to classify_intent due to validation error
      expect(decision.nextPrompt).toBe('classify_intent');
      expect(decision.reason).toContain('LLM returned invalid prompt');
    });

    test('LLM fallback handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failed'));
      const decision = await llmRouter.selectNextPrompt(baseState);
      expect(decision.nextPrompt).toBe('classify_intent');
      expect(decision.reason).toContain('LLM fallback failed');
    });

    test('LLM fallback can be disabled', async () => {
      const disabledRouter = HybridRouter.create({ enableLLMFallback: false });
      // No rules match → should throw
      await expect(disabledRouter.selectNextPrompt(baseState)).rejects.toThrow(
        'LLM fallback is disabled but no rule matched'
      );
    });
  });

  describe('Router State Updates', () => {
    test('decision updates routerState phase and lastDecision', async () => {
      const state: AgentState = {
        ...baseState,
        routerState: { ...baseState.routerState, requiresApproval: true },
      };
      const decision = await router.selectNextPrompt(state);
      expect(state.routerState.phase).toBe('hard-rule');
      expect(state.routerState.lastDecision?.ruleId).toBe(decision.nextPrompt);
      expect(state.routerState.lastDecision?.confidence).toBe(1.0);
      expect(state.routerState.lastDecision?.timestamp).toBe(decision.timestamp);
    });

    test('LLM fallback decision has confidence from config', async () => {
      const llmRouter = HybridRouter.create({
        enableLLMFallback: true,
        llmMinConfidence: 0.8,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                nextPrompt: 'classify_intent',
                reason: 'test',
              }),
            },
          }],
        }),
      } as Response);

      const state = createInitialState();
      const decision = await llmRouter.selectNextPrompt(state);
      expect(state.routerState.lastDecision?.confidence).toBe(0.8);
    });
  });

  describe('Extensibility via Registration', () => {
    test('registerHardRule adds new hard rule', async () => {
      router.registerHardRule((state: AgentState) => {
        if (state.metadata.testFlag === true) {
          return {
            nextPrompt: 'handle_error',
            source: 'hard_rule',
            reason: 'Test hard rule',
          };
        }
        return null;
      });

      const state: AgentState = {
        ...baseState,
        metadata: { testFlag: true },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('handle_error');
      expect(decision.source).toBe('hard_rule');
    });

    test('registerStateRule adds new state rule', async () => {
      router.registerStateRule((state: AgentState) => {
        if (state.context.newStateFlag === true) {
          return {
            nextPrompt: 'plan_query',
            source: 'state_based',
            reason: 'New state rule',
          };
        }
        return null;
      });

      const state: AgentState = {
        ...baseState,
        context: { newStateFlag: true },
      };
      const decision = await router.selectNextPrompt(state);
      expect(decision.nextPrompt).toBe('plan_query');
      expect(decision.source).toBe('state_based');
    });
  });

  describe('Validation', () => {
    test('invalid state throws', async () => {
      const invalidState = { ...baseState, version: 'invalid' } as unknown as AgentState;
      await expect(router.selectNextPrompt(invalidState)).rejects.toThrow();
    });

    test('valid state passes validation', async () => {
      const state = createInitialState();
      // No rules match, LLM fallback disabled → should throw
      await expect(router.selectNextPrompt(state)).rejects.toThrow(
        'LLM fallback is disabled but no rule matched'
      );
    });
  });
});