"""
aiproxy - Thin LiteLLM proxy for RecycleAI.
Dynamic tools/prompts from Postgres thread state, unified Langfuse traces.
See architecture.md for design.
"""
__version__ = "0.1.0"

from .hooks import async_pre_call_hook, async_post_call_success_hook
from .cli import serve