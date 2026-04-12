import { type AgentState } from '../state/schema';

/**
 * Hybrid Router Types
 *
 * For documentation, start at:
 * - `new-docs/00 - Maps of Content/Recycler AI Overview.md`
 * - `new-docs/04 - Permanent/Router/Overview.md`
 * - `new-docs/04 - Permanent/Extensibility/Hybrid Router Extensions.md`
 */

/**
 * Union of valid prompt names that the router can select.
 * This whitelist ensures LLM fallback cannot route to arbitrary prompts.
 *
 * Based on the architecture described in the docs graph:
 * - Hard‑rule prompts: `await_user`, `handle_error`
 * - State‑based workflow prompts: `classify_intent`, `plan_query`, `execute_tool_reasoning`, `analyze_results`, `respond`
 * - LLM‑fallback prompts: `semantic_router` (for ambiguity resolution)
 */
export type PromptName =
  // Hard‑rule prompts (safety / must‑interrupt)
  | 'await_user'
  | 'handle_error'
  // State‑based workflow prompts
  | 'classify_intent'
  | 'plan_query'
  | 'execute_tool_reasoning'
  | 'analyze_results'
  | 'respond'
  // LLM‑fallback (semantic routing)
  | 'semantic_router';

/**
 * Source of a routing decision.
 * Corresponds to the three phases of the Hybrid Router.
 */
export type RouteSource = 'hard_rule' | 'state_based' | 'llm_fallback';

/**
 * A routing decision produced by the Hybrid Router.
 * This drives the next step in the LangGraph execution engine.
 *
 * @see `new-docs/04 - Permanent/Router/Overview.md`
 */
export interface RouteDecision {
  /** The prompt to execute next */
  nextPrompt: PromptName;
  /** Which phase of the router produced this decision */
  source: RouteSource;
  /** Human‑readable reason for the decision (logged for observability) */
  reason: string;
  /** Optional snippet of state that influenced the decision (for debugging) */
  stateSnippet?: Partial<AgentState>;
  /** Timestamp of the decision (defaults to now) */
  timestamp?: string;
}

/**
 * A hard rule function.
 * Returns a RouteDecision if the rule matches, otherwise null.
 */
export type HardRule = (state: AgentState) => RouteDecision | null;

/**
 * A state‑based rule function.
 * Returns a RouteDecision if the state indicates a specific workflow step.
 */
export type StateRule = (state: AgentState) => RouteDecision | null;

/**
 * A custom rule function (for extensibility).
 * Returns a RouteDecision if the custom condition matches.
 *
 * @see `new-docs/04 - Permanent/Extensibility/Hybrid Router Extensions.md`
 */
export type CustomRule = (state: AgentState) => RouteDecision | null;

/**
 * Configuration for the Hybrid Router.
 */
export interface RouterConfig {
  /** Whether to enable LLM fallback (default: true) */
  enableLLMFallback: boolean;
  /** Base URL for the OpenRouter proxy (default: http://localhost:3000) */
  proxyBaseURL: string;
  /** Model to use for LLM fallback (default: 'openai/gpt-4o') */
  llmModel: string;
  /** Minimum confidence for LLM fallback decisions (default: 0.7) */
  llmMinConfidence: number;
}