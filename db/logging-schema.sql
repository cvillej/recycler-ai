-- Compatible with @langchain/community checkpointers (AsyncPostgresSaver) and psycopg2 queries.
-- Langfuse uses its own 'langfuse' DB/tables (managed by Langfuse migrations in docker-compose.langfuse.yml).

SET search_path TO recycleai;

-- conversation_threads: Thread state for dynamic tool/prompt selection (queried by aiproxy pre-hook)
CREATE TABLE IF NOT EXISTS conversation_threads (
  thread_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoints JSONB NOT NULL DEFAULT '[]'::jsonb,  -- LangGraph checkpoints/state snapshots
  focus_state TEXT,  -- e.g. 'market_research', 'general_chat' for tool selection
  pivot_detected BOOLEAN DEFAULT FALSE,  -- Flag for context shift
  messages_summary TEXT,  -- Compressed summary of recent messages (no full history)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_threads_thread_id ON conversation_threads (thread_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_updated_at ON conversation_threads (updated_at DESC);

-- llm_calls: Optional audit log (post-hook inserts for debugging/cost tracking)
CREATE TABLE IF NOT EXISTS llm_calls (
  id BIGSERIAL PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES conversation_threads(thread_id) ON DELETE CASCADE,
  model TEXT NOT NULL,  -- e.g. 'grok-beta'
  prompt TEXT NOT NULL,  -- Final assembled prompt (for inspection)
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  cache_hit BOOLEAN DEFAULT FALSE,
  selected_tools JSONB DEFAULT '[]'::jsonb,  -- Array of injected tool schemas
  response_headers JSONB DEFAULT '{}'::jsonb,  -- x-litellm-selected-model/tools etc.
  langfuse_trace_url TEXT,  -- Link to unified trace in Langfuse UI
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_calls_thread_id ON llm_calls (thread_id);
CREATE INDEX IF NOT EXISTS idx_llm_calls_model ON llm_calls (model);
CREATE INDEX IF NOT EXISTS idx_llm_calls_inserted_at ON llm_calls (inserted_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_success ON llm_calls (success) WHERE NOT success;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_threads_updated_at BEFORE UPDATE
  ON conversation_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE conversation_threads IS 'AIProxy state store: checkpoints, focus, pivots per thread_id (queried by hooks)';
COMMENT ON TABLE llm_calls IS 'AIProxy audit log: LLM calls with costs, tools, traces (inserted by post-hook)';

-- Verify:
-- SELECT * FROM conversation_threads LIMIT 1;
-- SELECT COUNT(*) FROM llm_calls WHERE thread_id = 'some-thread-uuid';