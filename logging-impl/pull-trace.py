#!/usr/bin/env python3
"""
logging-impl/pull-trace.py - Pull latest Langfuse trace (full session) + basic analysis MD.
Mirrors salvage-ai/scripts/tracing_dump.py.
Usage: LANGFUSE_SECRET_KEY=sk-... python pull-trace.py [session_id]
"""
import os
import json
from datetime import datetime
from langfuse import Langfuse

lf = Langfuse(
  secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
  public_key=os.getenv("LANGFUSE_PUBLIC_KEY", "pk-lf-9390cbcb-62d0-446d-81e3-aa5a4853b24a"),
  host=os.getenv("LANGFUSE_HOST", "http://localhost:3000"),
)

session_id = os.getenv("LANGFUSE_SESSION_ID") or input("Session ID (or enter for latest): ").strip() or None

if session_id:
  traces = lf.list_traces(session_id=session_id)
else:
  traces = lf.list_traces(limit=1)

if not traces:
  print("No traces found.")
  exit(1)

latest_trace = traces[0]
trace_data = latest_trace.to_json_dict()
ts = datetime.now().strftime("%Y%m%d-%H%M%S")

json_path = f"traces/latest-trace-{ts}.json"
md_path = f"traces/latest-trace-{ts}.md"

os.makedirs("traces", exist_ok=True)

with open(json_path, "w") as f:
  json.dump(trace_data, f, indent=2, default=str)

# Basic analysis MD
analysis = f"""# Trace Analysis: {latest_trace.name} ({ts})

**Session ID**: {latest_trace.session_id or 'N/A'}
**Observations**: {len(latest_trace.observations())}
**Generations**: {len(latest_trace.generations())}
**Cost**: ${latest_trace.usage().total_cost if latest_trace.usage() else 0:.4f}
**Model**: {latest_trace.model or 'N/A'}

## Key Spans
{chr(10).join([f"- {g.name}: {g.model} (input: {g.input_tokens}, output: {g.output_tokens})" for g in latest_trace.generations()[:5]])}

See JSON: {json_path}
"""

with open(md_path, "w") as f:
  f.write(analysis)

print(f"✅ Trace → {json_path}")
print(f"📊 Analysis → {md_path}")
print(f"Langfuse UI: {latest_trace.trace_url}")