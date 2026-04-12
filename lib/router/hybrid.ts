import {
  type AgentState,
  parseAgentState,
  createInitialState,
} from '../state/schema';
import {
  type PromptName,
  type RouteDecision,
  type RouteSource,
  type HardRule,
  type StateRule,
  type CustomRule,
  type RouterConfig,
} from './types';

/**
 * Hybrid Router
 *
 * Implements the 3‑phase routing architecture:
 * 1. Hard Rules (deterministic safety gates)
 * 2. State‑Based Decisions (workflow sequencing)
 * 3. LLM Fallback (ambiguity resolution)
 *
 * For documentation, start at:
 * - `new-docs/00 - Maps of Content/Recycler AI Overview.md`
 * - `new-docs/04 - Permanent/Router/Overview.md`
 * - `new-docs/04 - Permanent/Extensibility/Hybrid Router Extensions.md`
 *
 * This router is designed to be used by the LangGraph execution engine.
 * Each decision updates `routerState` (phase, lastDecision, pivotSignals) for observability.
 */
export class HybridRouter {
  private hardRules: HardRule[] = [];
  private stateRules: StateRule[] = [];
  private customRules: CustomRule[] = [];
  private config: RouterConfig;

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = {
      enableLLMFallback: true,
      proxyBaseURL: 'http://localhost:3000',
      llmModel: 'openai/gpt-4o',
      llmMinConfidence: 0.7,
      ...config,
    };
    this.registerDefaultHardRules();
    this.registerDefaultStateRules();
  }

  // --- Rule Registration (Extensibility) ---

  /**
   * Register a hard rule (deterministic safety gate).
   * Hard rules are checked first and cannot be overridden.
   */
  registerHardRule(rule: HardRule): void {
    this.hardRules.push(rule);
  }

  /**
   * Register a state‑based rule (workflow sequencing).
   * State rules are checked after hard rules.
   */
  registerStateRule(rule: StateRule): void {
    this.stateRules.push(rule);
  }

  /**
   * Register a custom rule (extensibility).
   * Custom rules are checked after state rules.
   *
   * @see `new-docs/04 - Permanent/Extensibility/Hybrid Router Extensions.md`
   */
  registerCustomRule(rule: CustomRule): void {
    this.customRules.push(rule);
  }

  // --- Default Rules (Core Logic) ---

  private registerDefaultHardRules(): void {
    // 1. Requires approval
    this.registerHardRule((state: AgentState): RouteDecision | null => {
      if (state.routerState.requiresApproval) {
        return {
          nextPrompt: 'await_user',
          source: 'hard_rule',
          reason: 'State requires human approval before proceeding',
          stateSnippet: { routerState: state.routerState },
        };
      }
      return null;
    });

    // 2. Last error with retry limit
    this.registerHardRule((state: AgentState): RouteDecision | null => {
      const retryCount = (state.metadata.retryCount as number) || 0;
      if (state.lastError && retryCount >= 3) {
        return {
          nextPrompt: 'handle_error',
          source: 'hard_rule',
          reason: `Retry limit exceeded (${retryCount} attempts). Last error: ${state.lastError.message}`,
          stateSnippet: { lastError: state.lastError, metadata: state.metadata },
        };
      }
      return null;
    });

    // 3. Terminal state (placeholder)
    this.registerHardRule((state: AgentState): RouteDecision | null => {
      if (state.metadata.terminal === true) {
        return {
          nextPrompt: 'respond',
          source: 'hard_rule',
          reason: 'Conversation reached terminal state',
          stateSnippet: { metadata: state.metadata },
        };
      }
      return null;
    });
  }

  private registerDefaultStateRules(): void {
    // 1. Needs intent classification
    this.registerStateRule((state: AgentState): RouteDecision | null => {
      if (state.context.needsIntentClassification === true) {
        return {
          nextPrompt: 'classify_intent',
          source: 'state_based',
          reason: 'Context indicates intent classification is needed',
          stateSnippet: { context: state.context },
        };
      }
      return null;
    });

    // 2. Has focus but no query plan
    this.registerStateRule((state: AgentState): RouteDecision | null => {
      if (state.context.focus === 'data_query' && !state.context.queryPlan) {
        return {
          nextPrompt: 'plan_query',
          source: 'state_based',
          reason: 'Focus is data_query but no query plan exists',
          stateSnippet: { context: state.context },
        };
      }
      return null;
    });

    // 3. Has query plan but no tool results
    this.registerStateRule((state: AgentState): RouteDecision | null => {
      if (state.context.queryPlan && !state.context.toolResults) {
        return {
          nextPrompt: 'execute_tool_reasoning',
          source: 'state_based',
          reason: 'Query plan exists, awaiting tool execution',
          stateSnippet: { context: state.context },
        };
      }
      return null;
    });

    // 4. Has tool results but not analyzed
    this.registerStateRule((state: AgentState): RouteDecision | null => {
      if (state.context.toolResults && !state.context.analysis) {
        return {
          nextPrompt: 'analyze_results',
          source: 'state_based',
          reason: 'Tool results available, need analysis',
          stateSnippet: { context: state.context },
        };
      }
      return null;
    });

    // 5. Ready to respond
    this.registerStateRule((state: AgentState): RouteDecision | null => {
      if (state.context.readyToRespond === true) {
        return {
          nextPrompt: 'respond',
          source: 'state_based',
          reason: 'State indicates ready to formulate final response',
          stateSnippet: { context: state.context },
        };
      }
      return null;
    });

    // 6. Pivot signals detected
    this.registerStateRule((state: AgentState): RouteDecision | null => {
      if (state.routerState.pivotSignals.length > 0) {
        return {
          nextPrompt: 'classify_intent',
          source: 'state_based',
          reason: `Pivot signals detected: ${state.routerState.pivotSignals.join(', ')}`,
          stateSnippet: { routerState: state.routerState },
        };
      }
      return null;
    });
  }

  // --- Phase Execution ---

  private checkHardRules(state: AgentState): RouteDecision | null {
    for (const rule of this.hardRules) {
      const decision = rule(state);
      if (decision) {
        return decision;
      }
    }
    return null;
  }

  private checkStateRules(state: AgentState): RouteDecision | null {
    for (const rule of this.stateRules) {
      const decision = rule(state);
      if (decision) {
        return decision;
      }
    }
    return null;
  }

  private checkCustomRules(state: AgentState): RouteDecision | null {
    for (const rule of this.customRules) {
      const decision = rule(state);
      if (decision) {
        return decision;
      }
    }
    return null;
  }

  private async llmFallback(state: AgentState): Promise<RouteDecision> {
    if (!this.config.enableLLMFallback) {
      throw new Error('LLM fallback is disabled but no rule matched');
    }

    // Prepare messages for the LLM router
    const messages = [
      {
        role: 'system' as const,
        content: `You are a semantic router for a conversational AI system.
You must choose the next prompt from this whitelist: ${[
          'classify_intent',
          'plan_query',
          'execute_tool_reasoning',
          'analyze_results',
          'respond',
          'semantic_router',
        ].join(', ')}.

Respond with a JSON object: { "nextPrompt": "<prompt>", "reason": "<brief explanation>" }`,
      },
      {
        role: 'user' as const,
        content: `Current state:
- Last user message: ${state.messages.slice(-1)[0]?.content || 'none'}
- Context keys: ${Object.keys(state.context).join(', ')}
- Router phase: ${state.routerState.phase}
- Pivot signals: ${state.routerState.pivotSignals.join(', ')}

What should the system do next?`,
      },
    ];

    try {
      const response = await fetch(`${this.config.proxyBaseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.llmModel,
          messages,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM proxy returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM response missing content');
      }

      const parsed = JSON.parse(content);
      const nextPrompt = parsed.nextPrompt as PromptName;
      const reason = parsed.reason as string;

      // Validate whitelist
      const validPrompts: PromptName[] = [
        'classify_intent',
        'plan_query',
        'execute_tool_reasoning',
        'analyze_results',
        'respond',
        'semantic_router',
      ];
      if (!validPrompts.includes(nextPrompt)) {
        throw new Error(`LLM returned invalid prompt: ${nextPrompt}`);
      }

      return {
        nextPrompt,
        source: 'llm_fallback',
        reason: `LLM fallback: ${reason}`,
        stateSnippet: {
          messages: state.messages.slice(-2),
          context: state.context,
          routerState: state.routerState,
        },
      };
    } catch (error) {
      // Fallback to a safe default
      return {
        nextPrompt: 'classify_intent',
        source: 'llm_fallback',
        reason: `LLM fallback failed: ${error instanceof Error ? error.message : String(error)}. Defaulting to classify_intent.`,
        stateSnippet: { lastError: state.lastError },
      };
    }
  }

  // --- Public API ---

  /**
   * Select the next prompt based on the current agent state.
   * Follows the 3‑phase order: Hard Rules → State Rules → Custom Rules → LLM Fallback.
   *
   * **Mutates** `state.routerState` in place (updates phase, lastDecision).
   *
   * @param state - Current AgentState (will be validated and mutated)
   * @returns RouteDecision with nextPrompt, source, and reason
   */
  async selectNextPrompt(state: AgentState): Promise<RouteDecision> {
    // Ensure state is validated (throws if invalid)
    parseAgentState(state);

    let decision: RouteDecision | null = null;

    // Phase 1: Hard Rules
    decision = this.checkHardRules(state);
    if (decision) {
      return this.finalizeDecision(decision, state);
    }

    // Phase 2: State Rules
    decision = this.checkStateRules(state);
    if (decision) {
      return this.finalizeDecision(decision, state);
    }

    // Phase 3: Custom Rules (extensibility)
    decision = this.checkCustomRules(state);
    if (decision) {
      return this.finalizeDecision(decision, state);
    }

    // Phase 4: LLM Fallback
    decision = await this.llmFallback(state);
    return this.finalizeDecision(decision, state);
  }

  private finalizeDecision(decision: RouteDecision, state: AgentState): RouteDecision {
    const timestamp = new Date().toISOString();
    const finalized: RouteDecision = {
      ...decision,
      timestamp: decision.timestamp || timestamp,
    };

    // Update routerState (in‑memory; caller should persist)
    state.routerState.phase = decision.source === 'hard_rule' ? 'hard-rule' :
                              decision.source === 'state_based' ? 'state-based' : 'llm-fallback';
    state.routerState.lastDecision = {
      ruleId: decision.nextPrompt,
      confidence: decision.source === 'llm_fallback' ? this.config.llmMinConfidence : 1.0,
      timestamp: finalized.timestamp,
    };

    // Log for observability (in production, emit to OpenTelemetry/LangSmith)
    console.debug(`[HybridRouter] Decision: ${decision.nextPrompt} (${decision.source}) - ${decision.reason}`);

    return finalized;
  }

  /**
   * Creates a new router with default rules.
   * Convenience factory.
   */
  static create(config?: Partial<RouterConfig>): HybridRouter {
    return new HybridRouter(config);
  }
}