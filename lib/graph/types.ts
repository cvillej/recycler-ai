import type { AgentState } from '../state/schema';
import type { PromptName } from '../router/types';

/**
 * LangGraph Execution Engine Types
 *
 * For documentation, start at:
 * - `new-docs/00 - Maps of Content/Recycler AI Overview.md`
 * - `new-docs/04 - Permanent/Architecture/Execution Engine.md`
 */

/**
 * Configuration for the execution graph.
 */
export interface GraphConfig {
  /** OpenRouter proxy URL for LLM calls. */
  proxyBaseURL: string;
  /** Default LLM model. */
  llmModel: string;
  /** Checkpoint storage (memory, file, DB). */
  checkpointer: any; // LangGraph checkpointer instance
  /** Whether to enable interrupts for human-in-the-loop. */
  enableInterrupts: boolean;
}

/**
 * Input for invoking the graph.
 */
export interface GraphInput {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  threadId?: string;
  context?: Record<string, unknown>;
}

/**
 * Output from the graph invocation.
 */
export interface GraphOutput {
  state: AgentState;
  finalMessage: string;
  isTerminal: boolean;
  checkpointId: string;
}
