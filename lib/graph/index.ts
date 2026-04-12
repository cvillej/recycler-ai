import { MemorySaver } from '@langchain/langgraph';
import { buildExecutionGraph } from './builder';
import { createInitialState } from '../state/schema';
import type { AgentState } from '../state/schema';
import type { GraphConfig, GraphInput, GraphOutput } from './types';

/**
 * LangGraph Execution Engine
 *
 * The main orchestrator for Recycler AI workflows.
 *
 * For documentation, start at:
 * - `new-docs/00 - Maps of Content/Recycler AI Overview.md`
 * - `new-docs/04 - Permanent/Architecture/Execution Engine.md`
 */

/**
 * Creates the full execution graph with checkpointer.
 *
 * @param config - Graph configuration.
 * @returns Runnable graph with checkpointing.
 */
export function createOrchestrator(config: GraphConfig) {
  const graph = buildExecutionGraph(config);

  // Use MemorySaver for now; can be swapped for PostgresSaver, etc.
  const checkpointer = config.checkpointer || createCheckpointSaver();

  return graph.compile({
    checkpointer,
  });
}

/**
 * Invokes the graph with a new input.
 *
 * @param input - Initial input (messages, context).
 * @param config - Graph configuration.
 * @returns Final output and state.
 */
export async function invokeGraph(
  input: GraphInput,
  config: GraphConfig
): Promise<GraphOutput> {
  const orchestrator = createOrchestrator(config);
  const initialState = createInitialState(input.threadId);
  initialState.messages = input.messages.map((m, i) => ({
    id: `msg-${i}`,
    role: m.role,
    content: m.content,
    timestamp: new Date().toISOString(),
  }));
  initialState.context = input.context || {};

  const result = await orchestrator.invoke(initialState);

  return {
    state: result as AgentState,
    finalMessage: result.messages.slice(-1)[0]?.content || 'No response generated.',
    isTerminal: !!result.metadata?.terminal,
    checkpointId: `thread-${input.threadId || 'default'}`,
  };
}

/**
 * Resumes a graph execution from a checkpoint.
 *
 * @param threadId - The thread/checkpoint ID.
 * @param update - New input (e.g., user message).
 * @param config - Graph configuration.
 * @returns Updated output and state.
 */
export async function resumeGraph(
  threadId: string,
  update: GraphInput,
  config: GraphConfig
): Promise<GraphOutput> {
  const orchestrator = createOrchestrator(config);

  const result = await orchestrator.invoke(
    {
      messages: update.messages,
    },
    {
      configurable: {
        thread_id: threadId,
      },
    }
  );

  return {
    state: result as AgentState,
    finalMessage: result.messages.slice(-1)[0]?.content || 'No response generated.',
    isTerminal: !!result.metadata?.terminal,
    checkpointId: threadId,
  };
}

/**
 * Convenience function for streaming graph execution.
 * (Future enhancement for Chat Transport integration.)
 */
export async function streamGraph(
  input: GraphInput,
  config: GraphConfig
) {
  const orchestrator = createOrchestrator(config);
  // Streaming implementation using orchestrator.stream()
  // Placeholder for now
  return orchestrator.stream(input);
}
