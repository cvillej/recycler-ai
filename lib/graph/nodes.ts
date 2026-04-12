import { HybridRouter } from '../router/hybrid';
import { getPromptExecutor } from '../prompts/registry';
import { parseAgentState } from '../state/schema';
import type { AgentState } from '../state/schema';
import type { GraphConfig } from './types';

/**
 * Creates the router node for the LangGraph.
 *
 * This node calls the HybridRouter to decide the next prompt.
 *
 * @param router - The HybridRouter instance.
 */
export function createRouterNode(router: HybridRouter) {
  return async (state: AgentState): Promise<AgentState> => {
    // Validate state
    const validatedState = parseAgentState(state);

    // Get routing decision (mutates routerState)
    const decision = await router.selectNextPrompt(validatedState);

    // Return updated state with decision metadata
    return {
      ...validatedState,
      metadata: {
        ...validatedState.metadata,
        lastRouteDecision: decision,
      },
    };
  };
}

/**
 * Creates a prompt node for a specific PromptName.
 *
 * This node executes the prompt using the registry executor.
 *
 * @param promptName - The PromptName to execute.
 * @param proxyBaseURL - Proxy URL for LLM calls.
 * @param llmModel - Default LLM model.
 */
export function createPromptNode(
  promptName: string,
  proxyBaseURL: string,
  llmModel: string
) {
  return async (state: AgentState): Promise<AgentState> => {
    try {
      const executor = getPromptExecutor(promptName as any);
      const update = await executor(state, { proxyBaseURL, llmModel });
      return {
        ...state,
        ...update,
      };
    } catch (error) {
      console.error(`[PromptNode:${promptName}] Error:`, error);
      return {
        ...state,
        lastError: {
          message: `Prompt execution failed for ${promptName}: ${error instanceof Error ? error.message : String(error)}`,
          code: 'PROMPT_EXECUTION_FAILED',
          timestamp: new Date().toISOString(),
        },
      };
    }
  };
}

/**
 * Error handling node.
 * This is called when a hard rule detects excessive retries.
 */
export function errorNode() {
  return async (state: AgentState): Promise<AgentState> => {
    // Log error and prepare for human intervention or fallback
    return {
      ...state,
      routerState: {
        ...state.routerState,
        requiresApproval: true,
      },
      metadata: {
        ...state.metadata,
        errorHandled: true,
      },
    };
  };
}

/**
 * Interrupt node for await_user (human-in-the-loop).
 * This is a no-op that signals the graph to pause.
 */
export function awaitUserNode() {
  return async (state: AgentState): Promise<AgentState> => {
    // No-op; the graph will interrupt here
    return state;
  };
}
