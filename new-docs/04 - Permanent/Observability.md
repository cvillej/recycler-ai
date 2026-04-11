---
template: Recycler Note Template
type: architecture-observability
tags: [recycle-ai, observability]
created: {{date:YYYY-MM-DD}}
updated: {{date:YYYY-MM-DD}}
status: stable
---

# Observability

**Purpose**  
Provides end-to-end tracing, structured logging, and debugging capabilities using OpenTelemetry and LangSmith.

**Key Concepts**
- Trace/span correlation with redaction and sampling.
- LangSmith Docker setup for visualization.
- Integration with LangGraph checkpoints and router decisions.

**Target Architecture (TypeScript)**
Instrumentation is set up at the LangGraph level and in the hybrid router to emit structured events.

**Current Implementation**: None yet (skeleton only).

**Source of Truth**: `[docs/observability-tracing.md](docs/observability-tracing.md)`

**Links to Related Concepts**
- `[[Execution Engine|LangGraph node/edge tracing]]`
- `[[Hybrid Router Extensions|Router decision logging]]`
- `[[Recycler AI Overview|Overall system data flow]]`

**Backlinks**