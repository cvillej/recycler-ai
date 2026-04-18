# AIProxy Architecture & Implementation Guide

**Version**: 1.0 (April 2026)  
**Author**: Grok (collaborative architecture session with user)  
**Purpose**: This is the **single source of truth** for implementing the complete new architecture. It captures **every nuance, decision, and trade-off** from our entire conversation. Use this document to build, deploy, and maintain the system.

## 1. Goals & Architectural Principles

The new architecture centralizes intelligence in a Python layer while keeping the React-style LangGraph TS app extremely thin. Key goals:

- **Dynamic, modular prompt building**: Assemble small, single-purpose prompts in the proxy based on key indicators or thread context.
- **Dynamic, minimal tool injection**: Select and inject only context-relevant tool definitions (e.g., market-research tools only when intent/focus matches) to reduce token cost and model choice paralysis.
- **Multi-turn agent continuity** without sending full history on every call.
- **Native prompt caching + cost reduction** maximized by consistent final prompts/tools.
- **Unified observability**: One seamless Langfuse trace/session across TS LangGraph orchestration and LiteLLM processing (no gaps).
- **Maintainable customization**: Avoid heavy forking of LiteLLM core. Use thin wrappers (called **aiproxy**) so upstream LiteLLM upgrades remain simple version bumps.
- **Production/sellable-app readiness**: Clean separation, easy deployment, budget/cost tracking, and Langfuse integration all in one place.
- **xAI/Grok-first**: Full native tool calling, streaming, and prefix caching support via LiteLLM.

**Core Decision**: Move prompt assembly + tool selection **completely out of TS** into Python wrappers/hooks. TS only orchestrates state, executes tools, and passes a `thread_id`.

## 2. High-Level Architecture

```
TS LangGraph React Agent (thin)
    ├── State / Memory (Postgres)
    ├── Tool Execution
    ├── Minimal payload (messages + extra_body.thread_id)
    └── HTTP → aiproxy (OpenAI-compatible endpoint)

aiproxy (Python package)
    ├── Depends on litellm (requirements.txt)
    ├── Custom pre/post call hooks + wrappers
    ├── Tool Selector (Postgres-aware)
    ├── Modular Prompt Manager
    ├── Langfuse OTEL enrichment
    ├── LiteLLM native: cost tracking, budgets, caching, prompt mgmt
    └── Starts/stops LiteLLM proxy server programmatically

Postgres
    ├── conversation_threads (thread_id, checkpoints, focus_state, pivot_detected, messages summary)
    └── llm_calls (optional audit log for debugging)

Langfuse
    ├── Single session per thread_id
    ├── TS spans + LiteLLM spans merged
    ├── Full prompt, selected tools, model, cost, cache hits, budget status
```

## 3. Core Components & Decisions

### 3.1 LangGraph TS App (Minimal Layer)
- Uses `@langchain/langgraph` (React-style agent).
- Stores full thread state/checkpoints in Postgres via `@langchain/postgres`.
- On every LLM call: send `thread_id` in `extra_body.metadata` (and optionally minimal recent messages).
- Receives selected model/tools back via custom response headers from post-call hook.
- Continues using LangGraph.js primitives for nodes, edges, conditional routing.
- **Decision**: No more tool selection or full prompt building in TS. Only orchestration + tool execution.

### 3.2 aiproxy (Thin Python Wrapper Package)
- **Structure**: Small Python package (pyproject.toml / setup.py) that lists `litellm[proxy]` in dependencies.
- **Not a heavy fork**: Uses official extension points (pre/post hooks, CustomPromptManagement, callbacks) + thin wrappers.
- **Responsibilities**:
  - Load custom config + register hooks.
  - Provide `aiproxy serve` CLI / programmatic start/stop.
  - Own product-specific logic (tool selector, prompt assembly, thread_id correlation).
  - Enrich LiteLLM features (cost, budgets, prompt management) into Langfuse traces.
- **Upgrade Strategy**: Bump `litellm` version in requirements.txt. Wrappers stay stable. Only rare internal patches (isolated and documented).

### 3.3 Postgres (Primary Store)
- Primary store for threads, checkpoints, focus/pivot detection, memory management.
- **Decision**: Use Postgres over OpenSearch for short-term history and structured state (LangGraph.js native support).
- Optional OpenSearch/pgvector for long-term semantic recall only.
- Hook queries Postgres by `thread_id` for fast context (avoids scanning full messages list).

### 3.4 Langfuse (Unified Observability)
- **Decision**: Full pivot from LangSmith. Langfuse becomes the single pane of glass.
- Uses **Langfuse OTEL callback** on LiteLLM side + official JS integration on TS side.
- Correlation via `thread_id` as Langfuse `session_id` (deterministic `trace_id` optional).
- Captures: TS agent steps, LiteLLM final prompt, injected tools, selected model, cost, cache hits, budget events, prompt version.

### 3.5 LiteLLM Features Integration
- **Cost tracking**: Automatically flows into Langfuse generation spans.
- **Budgets**: Enforced at proxy; violations enriched as metadata/events in traces.
- **Prompt management**: Use LiteLLM’s built-in (or CustomPromptManagement) + your modular templates. Final assembled prompt + version visible in traces.
- All enriched via hooks so traces feel like “one app.”

## 4. Detailed End-to-End Flow (LLM Call in Agent Loop)

1. TS LangGraph node prepares minimal payload + `extra_body.thread_id`.
2. Calls aiproxy `/v1/chat/completions`.
3. **Pre-call hook** (aiproxy):
   - Queries Postgres by `thread_id` for focus/pivot state.
   - Calls `tool_selector.select_tools(thread_id)`.
   - Assembles modular prompt.
   - Injects minimal `tools` array + `tool_choice`.
   - Adds metadata for Langfuse.
4. LiteLLM handles routing, caching, cost calc, xAI translation.
5. LLM response → **Post-call hook** (aiproxy):
   - Injects `x-litellm-selected-model` and `x-litellm-selected-tools` headers.
   - Enriches Langfuse trace.
6. TS receives response + headers → logs locally + continues agent loop.
7. All appears in one Langfuse session.

## 5. Key Code Snippets (Ready to Copy)

### 5.1 aiproxy Package Structure
```
aiproxy/
├── pyproject.toml
├── aiproxy/
│   ├── __init__.py
│   ├── cli.py                 # aiproxy serve
│   ├── config.py
│   ├── hooks.py               # pre/post call hooks
│   ├── tool_selector.py
│   ├── prompt_manager.py
│   └── langfuse_enricher.py
└── requirements.txt           # litellm[proxy] + psycopg2 + langfuse
```

### 5.2 Pre/Post Call Hooks (`hooks.py`)
```python
# aiproxy/aiproxy/hooks.py
from litellm import UserAPIKeyAuth, DualCache
from .tool_selector import select_tools
from .prompt_manager import assemble_prompt
import psycopg2

async def async_pre_call_hook(user_api_key_dict, cache, data, call_type, **kwargs):
    if call_type != "completion":
        return data
    thread_id = data.get("extra_body", {}).get("metadata", {}).get("thread_id")
    if not thread_id:
        return data

    # Tool selection + prompt assembly
    relevant_tools = select_tools(thread_id)
    data["tools"] = relevant_tools
    data["tool_choice"] = "auto"
    data["messages"] = assemble_prompt(data.get("messages", []), thread_id)

    # Store for post-hook
    data["_selected_tools"] = relevant_tools
    data["metadata"] = {**data.get("metadata", {}), "thread_id": thread_id}
    return data

async def async_post_call_success_hook(data, user_api_key_dict, response, **kwargs):
    selected_tools = data.get("_selected_tools", [])
    selected_model = data.get("model")
    if not hasattr(response, "_hidden_params"):
        response._hidden_params = {}
    response._hidden_params.setdefault("additional_headers", {})
    response._hidden_params["additional_headers"].update({
        "x-litellm-selected-model": selected_model,
        "x-litellm-selected-tools": ",".join(t.get("function", {}).get("name", "") for t in selected_tools),
    })
    return response
```

### 5.3 Tool Selector (`tool_selector.py`)
```python
# aiproxy/aiproxy/tool_selector.py
import psycopg2
from typing import List, Dict

def select_tools(thread_id: str) -> List[Dict]:
    with psycopg2.connect(...) as conn:  # use connection pool in prod
        cur = conn.cursor()
        cur.execute("""
            SELECT focus_state, pivot_detected, last_messages_summary
            FROM conversation_threads
            WHERE thread_id = %s
            ORDER BY checkpoint_id DESC LIMIT 1
        """, (thread_id,))
        row = cur.fetchone()
        if not row:
            return [get_fallback_tool_schema()]

        focus, pivot, summary = row
        if "market_research" in focus or pivot == "market":
            return [get_tool_schema("search_web"), get_tool_schema("get_competitor_data"), ...]
        # ... other intent rules
        return [get_fallback_tool_schema()]
```

### 5.4 TS LangGraph Integration (Minimal)
```ts
// In your LangGraph node / agent runner
const llm = new ChatOpenAI({
  baseURL: "http://localhost:4000/v1",  // aiproxy
  extra_body: {
    metadata: { thread_id: currentThreadId }
  },
  callbacks: [langfuseHandler]  // with sessionId = threadId
});

// After response
const selectedModel = response.response?.headers?.["x-litellm-selected-model"];
const selectedTools = response.response?.headers?.["x-litellm-selected-tools"]?.split(",") || [];
console.log(`[aiproxy] Model: ${selectedModel}, Tools: ${selectedTools}`);
```

### 5.5 Langfuse Setup
**LiteLLM config.yaml** (in aiproxy):
```yaml
litellm_settings:
  callbacks: ["langfuse_otel"]
```

**TS** (as shown in previous messages): `sessionId: threadId`.

### 5.6 aiproxy Startup/Shutdown (`cli.py`)
```python
# aiproxy/aiproxy/cli.py
import litellm.proxy.proxy_server as proxy_server
import uvicorn
from .hooks import async_pre_call_hook, async_post_call_success_hook

def serve():
    # Register hooks
    litellm.pre_call_hook = async_pre_call_hook
    litellm.async_post_call_success_hook = async_post_call_success_hook
    # Load config.yaml + custom aiproxy settings
    uvicorn.run(proxy_server.app, host="0.0.0.0", port=4000)
```

## 6. Maintenance, Upgrades & Gotchas

- **LiteLLM upgrades**: `uv pip install -U litellm` → test wrappers → done.
- **When a core patch is truly needed**: Keep it isolated in a small patch file that can be re-applied.
- **Gotchas addressed**:
  - Tool stability for caching → deterministic per thread state.
  - Multi-turn continuity → Postgres query per call.
  - Observability gaps → `thread_id` as session_id + headers.
  - Latency → fast DB queries + pre-loaded templates.
- **Deployment**: Docker image containing aiproxy package + LiteLLM. `CMD ["aiproxy", "serve"]`.

