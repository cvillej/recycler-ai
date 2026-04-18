"""
aiproxy.tool_selector - Dynamic tool injection based on thread focus/pivot/summary from Postgres.
Example rules: market_research → web_search + competitor_data; else fallback.
"""
import psycopg2
from typing import List, Dict

def get_fallback_tool_schema() -> Dict:
  """Fallback single-purpose tool."""
  return {
    "type": "function",
    "function": {
      "name": "fallback_tool",
      "description": "General fallback when no focus detected."
    }
  }

def get_tool_schema(name: str) -> Dict:
  """Tool schema factory by name."""
  schemas = {
    "search_web": {
      "type": "function",
      "function": {
        "name": "search_web",
        "description": "Search the web for current information."
      }
    },
    "get_competitor_data": {
      "type": "function",
      "function": {
        "name": "get_competitor_data",
        "description": "Fetch competitor pricing and market data."
      }
    },
    # Add more modular tools...
  }
  return schemas.get(name, get_fallback_tool_schema())

def select_tools(thread_id: str, focus_state: str = None, pivot_detected: bool = None, summary: str = None) -> List[Dict]:
  """
  Select context-relevant tools from Postgres thread state.
  Deterministic for caching.
  """
  if not focus_state:
    # Query Postgres (stubbed; call from hooks)
    conn = psycopg2.connect(dsn="your-dsn")  # From config.py
    cur = conn.cursor()
    cur.execute("""
      SELECT focus_state, pivot_detected, messages_summary
      FROM conversation_threads
      WHERE thread_id = %s ORDER BY updated_at DESC LIMIT 1
    """, (thread_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
      focus_state, pivot_detected, summary = row
    else:
      focus_state = "general"

  if "market_research" in focus_state.lower() or pivot_detected:
    return [get_tool_schema("search_web"), get_tool_schema("get_competitor_data")]
  # Add rules for other focus: e.g. "pricing" → pricing_tools
  return [get_fallback_tool_schema()]