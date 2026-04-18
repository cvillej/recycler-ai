"""
aiproxy.hooks - Pre/post call hooks for LiteLLM proxy.
Registers dynamically per thread_id: tool selection, prompt assembly, Langfuse metadata, response headers.
See architecture.md §5.2 for details.
"""
import json
import psycopg2
from typing import Dict, Any, List
from litellm import completion
from .tool_selector import select_tools
from .prompt_manager import assemble_prompt

async def async_pre_call_hook(
  user_api_key_dict: Dict[str, Any],
  cache: Any,
  data: Dict[str, Any],
  call_type: str,
  **kwargs
) -> Dict[str, Any]:
  """
  Pre-call: Extract thread_id, query Postgres for state, select tools, assemble prompt, add metadata.
  """
  if call_type != "completion":
    return data

  extra_body = data.get("extra_body", {})
  metadata = extra_body.get("metadata", {})
  thread_id = metadata.get("thread_id")
  if not thread_id:
    return data

  # Query Postgres for thread state (focus/pivot/summary)
  conn = psycopg2.connect(...)  # Use config.py pool
  cur = conn.cursor()
  cur.execute("""
    SELECT focus_state, pivot_detected, messages_summary
    FROM conversation_threads
    WHERE thread_id = %s
    ORDER BY updated_at DESC LIMIT 1
  """, (thread_id,))
  row = cur.fetchone()
  cur.close()
  conn.close()

  if row:
    focus, pivot, summary = row
  else:
    focus, pivot, summary = "general", False, ""

  # Dynamic logic
  relevant_tools = select_tools(thread_id, focus, pivot, summary)
  data["tools"] = relevant_tools
  data["tool_choice"] = "auto"

  messages = data.get("messages", [])
  data["messages"] = assemble_prompt(messages, thread_id, summary)

  # Store for post-hook + Langfuse metadata
  data["_selected_tools"] = relevant_tools
  data["_selected_model"] = data.get("model", "grok-beta")
  metadata["thread_id"] = thread_id
  metadata["focus_state"] = focus
  metadata["pivot_detected"] = pivot
  extra_body["metadata"] = metadata
  data["extra_body"] = extra_body

  return data

async def async_post_call_success_hook(
  data: Dict[str, Any],
  user_api_key_dict: Dict[str, Any],
  response: Any,
  **kwargs
) -> Any:
  """
  Post-call: Add custom headers (model/tools for TS), enrich Langfuse trace.
  """
  selected_tools = data.get("_selected_tools", [])
  selected_model = data.get("_selected_model", data.get("model", "unknown"))

  if not hasattr(response, "_hidden_params"):
    response._hidden_params = {}

  additional_headers = response._hidden_params.setdefault("additional_headers", {})
  additional_headers.update({
    "x-litellm-selected-model": selected_model,
    "x-litellm-selected-tools": ",".join(t.get("function", {}).get("name", "") for t in selected_tools) if selected_tools else "",
  })

  # Langfuse enrichment via langfuse_enricher (OTEL callback handles spans)
  from .langfuse_enricher import enrich_langfuse_trace
  await enrich_langfuse_trace(data, response)

  return response