"""
aiproxy.prompt_manager - Modular prompt assembly: prepend focus-specific system prompt.
Dynamic, consistent for caching.
"""
from typing import List, Dict, Any

def get_system_prompt(focus_state: str, summary: str = "") -> str:
  """Focus-specific system prompt template."""
  templates = {
    "market_research": "You are a salvage yard pricing expert. Focus on market comps, competitor pricing, part-out value. Use provided tools for web/search data. Summary: {summary}",
    "general": "You are a helpful assistant for recycle-ai queries. Use tools as needed.",
    # Modular: add per focus
  }
  base = templates.get(focus_state, templates["general"])
  return base.format(summary=summary)

def assemble_prompt(messages: List[Dict[str, Any]], thread_id: str, summary: str = "") -> List[Dict[str, Any]]:
  """
  Assemble final messages: prepend system prompt based on focus/summary.
  """
  # Fetch focus from Postgres if needed (stub; from hooks)
  focus_state = "general"  # From hooks data

  system_prompt = get_system_prompt(focus_state, summary)
  assembled = [{"role": "system", "content": system_prompt}] + messages

  return assembled