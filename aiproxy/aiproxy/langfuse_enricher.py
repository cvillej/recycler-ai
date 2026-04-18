"""
aiproxy.langfuse_enricher - OTEL/Langfuse trace enrichment (cost, budget, prompt version, thread correlation).
Called from post-hook; langfuse_otel callback auto-handles spans.
"""
from langfuse import Langfuse
from opentelemetry import trace
from typing import Dict, Any
import os

LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "http://localhost:3000")

lf = Langfuse(
  public_key=LANGFUSE_PUBLIC_KEY,
  secret_key=LANGFUSE_SECRET_KEY,
  host=LANGFUSE_HOST,
)

async def enrich_langfuse_trace(data: Dict[str, Any], response: Any):
  """Enrich active trace with LiteLLM metadata (cost, tools, cache, budget events)."""
  thread_id = data["extra_body"]["metadata"]["thread_id"]
  
  # Get current span (OTEL context)
  current_span = trace.get_current_span()
  if current_span.is_recording():
    current_span.set_attribute("litellm.model", data.get("model", "unknown"))
    current_span.set_attribute("litellm.prompt_tokens", response.usage.prompt_tokens if response.usage else 0)
    current_span.set_attribute("litellm.completion_tokens", response.usage.completion_tokens if response.usage else 0)
    current_span.set_attribute("litellm.cache_hit", data.get("cache_hit", False))
    current_span.set_attribute("thread.focus_state", data["extra_body"]["metadata"].get("focus_state"))

  # Langfuse generation span (unified session)
  generation = lf.generation(
    name="litellm_completion",
    session_id=thread_id,
    input=data["messages"],
    output=response.choices[0].message.content if response.choices else "",
    model=data.get("model"),
    usage={
      "input": response.usage.prompt_tokens if response.usage else 0,
      "output": response.usage.completion_tokens if response.usage else 0,
    },
    metadata={
      "selected_tools": data.get("_selected_tools"),
      "prompt_version": "v1.0",  # From prompt_manager
    }
  )
  print(f"Langfuse trace: {generation.get('url')}")  # For llm_calls insert