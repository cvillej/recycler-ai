"""
aiproxy.config - Config loading + DB pool.
"""
import os
import yaml
import psycopg2.pool

# Load LiteLLM config.yaml
def load_config(path: str = "config.yaml") -> dict:
  with open(path, "r") as f:
    return yaml.safe_load(f)

# DB pool (thread-safe for LiteLLM async)
DSN = os.getenv(
  "AIPROXY_DB_DSN",
  "postgresql://postgres:postgres@localhost:5432/ai"  # Adjust user/pass/DB
)
DB_POOL = psycopg2.pool.ThreadedConnectionPool(
  minconn=1, maxconn=20, dsn=DSN
)

# Global litellm_settings (loaded in cli.py)
LITELLM_SETTINGS = None

# Langfuse (from env; auto-configured by OTEL callback)
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "http://localhost:3000")