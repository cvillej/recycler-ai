import { MemorySaver } from '@langchain/langgraph';

/**
 * Checkpoint saver factory for LangGraph.
 * Wraps MemorySaver for demo; swap for PostgresSaver in production.
 */
export function createCheckpointSaver() {
  return new MemorySaver();
}
