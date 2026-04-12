import { StateGraph } from '@langchain/langgraph';
import { messagesReducer, contextReducer, routerStateReducer, metadataReducer } from '../state/schema';
import { HybridRouter } from '../router/hybrid';
import { getPromptExecutor } from '../prompts/registry';
import type { AgentState } from '../state/schema';
import type { GraphConfig } from './types';
import { createRouterNode, createPromptNode } from './nodes';

/**
 * Builds the LangGraph execution engine.
 *
 * This creates a StateGraph that orchestrates the HybridRouter and Prompt System.
 *
 * For documentation, start at:
 * - `new-docs/00 - Maps of Content/Recycler AI Overview.md`
 * - `new-docs/04 - Permanent/Architecture/Execution Engine.md`
 *
 * @param config - Graph configuration.
 * @returns Compiled LangGraph instance.
 */
export function buildExecutionGraph(config: GraphConfig) {
  const router = new HybridRouter({
    proxyBaseURL: config.proxyBaseURL,
    llmModel: config.llmModel,
  });

  const graph = new StateGraph<AgentState>({
    channels: {
      messages: messagesReducer,
      context: contextReducer,
      routerState: routerStateReducer,
      metadata: metadataReducer,
    },
  });

  // Add router node
  graph.addNode('router', createRouterNode(router));

  // Add dynamic prompt nodes (one for each registered prompt)
  const registeredPrompts = ['classify_intent', 'plan_query', 'execute_tool_reasoning', 'analyze_results', 'respond', 'await_user', 'handle_error', 'semantic_router'];
  for (const promptName of registeredPrompts) {
    graph.addNode(promptName, createPromptNode(promptName, config.proxyBaseURL, config.llmModel));
  }

  // Entry point
  graph.addEdge('__start__', 'router');

  // Conditional edges from router to the selected prompt
  graph.addConditionalEdges('router', (state) => state.nextPrompt || 'respond', {
    classify_intent: 'classify_intent',
    plan_query: 'plan_query',
    execute_tool_reasoning: 'execute_tool_reasoning',
    analyze_results: 'analyze_results',
    respond: 'respond',
    await_user: 'await_user',
    handle_error: 'handle_error',
    semantic_router: 'semantic_router',
  });

  // Most prompts loop back to router for next decision
  const loopBackPrompts = ['classify_intent', 'plan_query', 'execute_tool_reasoning', 'analyze_results', 'semantic_router'];
  for (const promptName of loopBackPrompts) {
    graph.addEdge(promptName, 'router');
  }

  // Terminal prompts end the graph
  graph.addEdge('respond', '__end__');
  graph.addEdge('handle_error', '__end__');

  // Interrupt before await_user for human-in-the-loop
  if (config.enableInterrupts) {
    graph.addNode('await_user', (state) => state); // No-op for interrupt
    graph.interruptBefore(['await_user']);
  } else {
    graph.addEdge('await_user', 'router');
  }

  // Compile with checkpointer
  return graph.compile({
    checkpointer: config.checkpointer,
  });
}
