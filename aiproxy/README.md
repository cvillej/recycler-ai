# AIProxy - Thin LiteLLM Proxy Wrapper for RecycleAI

**Version**: 0.1.0

Thin Python package wrapping LiteLLM proxy server. Implements architecture.md goals:
- Dynamic tool selection + prompt assembly from Postgres thread state.
- Unified Langfuse traces (thread_id as session_id).
- Custom headers for TS LangGraph (selected model/tools).
- Easy LiteLLM upgrades (hooks + config).

## Quick Start

1. **Install deps**:
   ```
   cd aiproxy
   uv venv .venv
   uv pip install -r requirements.txt
   # or uv pip install -e . (editable for dev)
   ```

2. **Env vars**:
   ```
   AIPROXY_DB_DSN=postgresql://postgres:postgres@localhost:5432/ai
   LANGFUSE_PUBLIC_KEY=pk-...
   LANGFUSE_SECRET_KEY=sk-...
   LANGFUSE_HOST=http://localhost:3000
   # LiteLLM keys: OPENROUTER_API_KEY, XAI_API_KEY, etc.
   ```

3. **Serve**:
   ```
   aiproxy serve
   ```
   Proxy on http://localhost:4000/v1/chat/completions (OpenAI-compatible).

## Usage from TS LangGraph

```
const llm = new ChatOpenAI({
  baseURL: "http://localhost:4000/v1",
  extra_body: { metadata: { thread_id: currentThreadId } },
});
```

Parse headers:
```
const selectedModel = response.headers["x-litellm-selected-model"];
```

## Architecture

See [architecture.md](../architecture.md) for hooks flow, Postgres tables, Langfuse integration.

Files:
- `hooks.py`: pre/post call (tool/prompt/headers).
- `tool_selector.py`: focus → tools.
- `prompt_manager.py`: modular system prompt.
- `langfuse_enricher.py`: trace enrichment.
- `cli.py`: serve CLI.
- `config.yaml`: litellm_settings (langfuse_otel callback).