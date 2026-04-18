"""
aiproxy.cli - Entry point: aiproxy serve CLI.
Registers hooks, loads config, starts LiteLLM proxy server.
"""
import uvicorn
import litellm
from litellm.proxy.proxy_server import app as proxy_app
from .hooks import async_pre_call_hook, async_post_call_success_hook
from .config import load_config

def serve(host: str = "0.0.0.0", port: int = 4000, config_path: str = "config.yaml"):
  """Start aiproxy LiteLLM proxy server."""
  # Load config (DB pool, LiteLLM settings)
  litellm_config = load_config(config_path)

  # Register custom hooks
  litellm.pre_call_hook = async_pre_call_hook
  litellm.async_post_call_success_hook = async_post_call_success_hook

  # Apply LiteLLM config (callbacks: langfuse_otel)
  litellm.litellm_settings = litellm_config.get("litellm_settings", {})

  print(f"🚀 Starting aiproxy on http://{host}:{port}")
  print("Hooks registered: dynamic tools/prompts, Langfuse enrichment.")
  uvicorn.run(proxy_app, host=host, port=port, log_level="info")

if __name__ == "__main__":
  serve()