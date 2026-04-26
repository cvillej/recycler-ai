# observability.md
**Version:** April 26, 2026  
**Status:** Updated (Zoom Level 2) — Focused High-Value Tracing + Mem0 + Langfuse

This document defines the complete observability strategy for the AI Yard Assistant. It ensures every action, decision, failure, and user interaction is fully traceable, measurable, and actionable.

## Purpose of Observability

Observability is the foundation of trust, debugging, optimization, and continuous improvement in the AI Yard Assistant.

It enables us to:

- Understand exactly what happened in any conversation or background process
- Measure system health, performance, and business outcomes
- Detect and respond to issues in real time
- Learn from failures and successes to improve the system
- Provide transparency to users, operations, and leadership
- Support future multi-agent decomposition with clear visibility across agents

Without strong observability, even the best architecture becomes a black box.

## High-Value Tracing Priorities (Phase 0)

We take a **focused, high-value-first** approach to tracing:

Instead of instrumenting everything equally, we deeply trace the flows that have the highest impact on customer experience and business ROI from day one.

### Priority 1: Phone Channel (First-Class Citizen)
- All phone conversation flows
- Photo upload handling
- Async callbacks and "call me back" scenarios
- Phone-specific memory and focus management

### Priority 2: Auction Pivot Workflow
- Auction loss detection
- Pivot recommendation generation
- Multi-step pivot logic
- User interaction with recommendations

### Priority 3: Post-Purchase / eBay Listing Workflow
- Multi-step HITL process (part selection, photo requests, pricing)
- Workflow state management in Mem0
- External eBay integration calls

### Priority 4: Memory Operations (Mem0)
- All Mem0 reads, writes, and updates
- 3-level focus changes and drift detection
- Summarization operations
- Workflow-specific memory namespaces

### Priority 5: All HITL Interactions
- Proposal → User decision → Outcome flows
- Knock deep link interactions
- Approval gates and clarifications

### Priority 6: Key Business Decisions
- Entity resolution
- Pricing and valuation recommendations
- Bidding decisions and budget checks

For lower-priority paths (internal utilities, simple tools, non-critical background jobs), we use lighter or selective tracing.

This approach gives us excellent visibility where it matters most while maintaining high development velocity.

## Core Principles

1. **contextId as the Universal Session Key** — Every trace, log, metric, and event is tied to a single `contextId`.
2. **Full Traceability** — From user message to final response (and all background jobs), nothing is invisible.
3. **Actionable Metrics** — We track what matters for business outcomes, not just technical health.
4. **Privacy by Design** — Sensitive data is redacted or hashed in traces and logs.
5. **Cost Visibility** — Token usage, model costs, and infrastructure spend are tracked at the `contextId` and user level.
6. **Real-time + Historical** — Support both live dashboards and deep historical analysis.

## Primary Observability Platform: Langfuse

We use **Langfuse** as the central observability platform because it is purpose-built for LLM applications and supports:

- Full trace and span hierarchy
- Prompt versioning and A/B testing
- Cost and token tracking
- User feedback collection
- Session grouping (using `contextId` as `session_id`)
- Custom metrics and dashboards
- Integration with Slack, PagerDuty, and email for alerts

**Inngest** and **Knock** traces are also correlated with Langfuse under the same `contextId` for complete end-to-end visibility across the entire system.

## What Gets Traced

Every major component emits traces and events with rich context:

### Request Flow
- Full request lifecycle (ingestion → enrichment → resolution → LLM call → post-response)
- `PromptResolutionInput` and `PromptResolutionOutput` (including final prompt and tool/Skill list)
- Token count, latency, model used, cache hit/miss
- `effective_features` at time of request
- Decision Traceability fields (`decision`, `reason`, `input`, `output`)

### Memory Management
- Summarization triggers and outcomes
- Compaction cycles (phases, tokens saved, items pruned)
- Pivot detection and pivot_pipeline execution
- Checkpoint creation and restoration
- Memory decay and pruning decisions with metadata

### Feature Management
- `effective_features` resolution via 5-level cascade
- Permission cascade evaluation and results
- Quota checks and exhaustion events

### Tool Layer & Skills
- Tool and Skill selection and filtering
- Tool/Skill call success/failure with full input/output
- Entity resolution results (canonical ID, confidence, alternatives)
- LangGraph execution traces for Skills

### External Event Controller & Inngest
- Event ingestion (source, type, payload summary)
- Context Enricher decisions
- Inngest workflow execution, retries, "wait for event" steps, and HITL orchestration
- Full Inngest trace IDs linked to `contextId`

### Knock Notifications
- Notification dispatch decisions (type, channel, priority, importance)
- Delivery status (sent, delivered, clicked, responded)
- Deep link generation and webhook responses
- HITL resolution outcomes and user decisions

### HITL & Failures
- Every failure (hard/soft/quota) with category, confidence, and resolution path
- HITL interactions (proposal, user decision, outcome)
- Linked Inngest trace ID and Knock delivery status

### Background Jobs
- Long-running report generation and bulk operations
- Scheduled memory jobs (via Inngest)
- Data sync and external system jobs

### Memory (Mem0)
Mem0 is the primary memory engine. All memory operations must be fully observable in Langfuse:

- **Memory Reads**: Every time `prompt_resolution`, Skills, or tools read from Mem0 (including `memory_summary`, `structured_memory`, and 3-level focus).
- **Memory Writes/Updates**: Any creation or update of structured memory, workflow state, or focus levels.
- **Summarization Operations**: When Mem0 or our system triggers summarization of conversation history.
- **Focus Changes**: Any change to `overarching_focus`, `task_specific_focus`, or `subtask_focus`, including drift detection.
- **Retrieval Operations**: When Mem0 performs relevance-based retrieval for long-term memory.

**Recommended Tracing:**
- Use clear span names: `mem0.read`, `mem0.write`, `mem0.summarize`, `mem0.focus_change`
- Include attributes: `workflow` (e.g., `ebay_listing`), `focus_level_changed`, `tokens_from_memory`, `retrieval_score`
- All memory spans must include `contextId` for correlation.

All traces include `contextId`, `user_id`, `yard_id`, `focus_state`, and `timestamp` for easy correlation across systems.

## Decision Traceability Standard

Every important decision in the system **must** log the following four fields as structured attributes:

| Field            | Description                                                                 | Example |
|------------------|-----------------------------------------------------------------------------|---------|
| `decision`       | What was decided                                                              | `"grant_feature:proactive_bidding"` or `"select_skill:GenerateFullValuationReport"` |
| `reason`         | Why the decision was made                                                     | `"low_confidence_entity_resolution"` or `"user_in_active_bidding_session"` |
| `input`          | The key data considered (structured, redacted if needed)                      | `{ "entity_candidates": 3, "top_confidence": 0.67, ... }` |
| `output`         | What was produced as a result of the decision                                 | `{ "canonical_id": null, "action": "ask_for_clarification", ... }` |

These four fields are attached to every relevant span in Langfuse.

### Component Tagging

Every span is tagged with a `component` attribute:
- `entity_resolver`, `prompt_resolution`, `tool_layer`, `skill_execution`, `memory_management`, `context_enricher`, `inngest_workflow`, `knock_notification`, `hitl_gate`, `quota_enforcer`, etc.

### Configurable Observability

We support three levels of control:

1. **Global Level** (default): `error` / `warn` / `info` / `debug`
2. **Per-Component Level**: e.g. `inngest_workflow = debug`, `knock_notification = info`
3. **Dynamic Sampling**: 100% for errors/warnings/HITL, lower for normal operation

## Metrics & KPIs

### Core Business Metrics
- Conversation Success Rate
- HITL Resolution Rate
- Quota Exhaustion Conversion Rate
- Proactive Value Delivered (Knock engagement + deep link clicks)
- Feature Adoption Rate

### System Health Metrics
- Request Latency (p50/p95/p99)
- LLM Latency
- Tool & Skill Success Rate
- Entity Resolution Accuracy
- Soft Failure Resolution Rate
- Inngest Workflow Success Rate
- Knock Delivery & Click-through Rate

### Cost & Efficiency Metrics
- Tokens per Conversation
- Cost per Conversation
- Cache Hit Rate (prefix + memory summarization)
- Summarization / Compaction Savings
- Background Job Cost

All metrics are sliced by `user_plan`, `focus_state`, `yard_id`, and time.

## Dashboards & Alerts

**Core Dashboards:**
- Executive Dashboard (business outcomes)
- Operations Dashboard (includes Inngest + Knock health)
- Product & AI Quality Dashboard
- Cost & Performance Dashboard
- Failure & Incident Dashboard

**Alerting Rules:**
- **Critical**: Hard failure rate > 5%, external system outage, Inngest workflow failure rate spike, Knock delivery failure
- **Warning**: p95 latency degradation, low Knock engagement, high quota exhaustion
- **Info**: New failure patterns, feature adoption changes, cost anomalies

## Integration Points

Observability is deeply embedded in every layer:

- **Request Flow**: Every request creates a root trace in Langfuse with `contextId`.
- **External Event Controller / Inngest**: Every Inngest function and workflow is traced and linked to `contextId`.
- **Knock**: All notification dispatch, delivery, and interaction events are logged with `contextId`.
- **Memory Management**: Summarization and pivot operations are traced with rich metadata.
- **Tool Layer**: Every tool and Skill call (including LangGraph execution) is logged as a child span.
- **aiproxy / LiteLLM**: All LLM calls are traced with cost and cache status.

All layers use the shared **Observability SDK**, which enforces the Decision Traceability Standard and component tagging.

## Cost & Token Tracking

We track:
- Per-Request Cost and Per-Conversation Cost (attributed to `contextId` and `user_id`)
- Per-Feature Cost breakdown
- Cache Savings (prefix caching + memory summarization)
- Background Job Cost (Inngest workflows)

Real-time alerts are configured for high-cost conversations or users.

## Privacy & Data Retention

All structured attributes pass through a redaction layer:
- PII is hashed or removed
- Sensitive business data is redacted or summarized

**Retention Policy:**
- Full traces: 90 days
- Cost & token events: 13 months
- Hard failure logs: 13 months
- Debug traces: 7 days

## Extensibility

Observability is designed to evolve with the system.

**Adding New Components:**
- Register the component name
- Use the standard tracing helpers
- All Decision Traceability fields and component tagging are applied automatically

**Future Evolution:**
- Cross-agent trace correlation
- Agent-specific dashboards
- Predictive alerting based on learned patterns
- Advanced Inngest + Knock analytics

The foundation built here supports all of these without requiring a redesign.

## Summary

Observability in the AI Yard Assistant is a first-class, deeply integrated capability that provides:

- **Full Decision Traceability** — Every important decision logs `decision`, `reason`, `input`, and `output`.
- **Complete System Coverage** — Request Flow, Memory, Tools/Skills (LangGraph), Inngest workflows, Knock notifications, and HITL are all fully traced.
- **Configurable Verbosity** — Global and per-component levels with dynamic sampling.
- **Universal Context** — Every trace is tied to `contextId`, including Inngest and Knock events.
- **Business + Technical Metrics** — We measure what matters for users, cost, reliability, and product improvement.
- **Proactive Alerting** — Real-time detection with clear ownership.
- **Privacy by Design** — Strong redaction and retention policies.
- **Extensibility** — Easy to add new components and agents without infrastructure changes.

This observability system ensures the AI Yard Assistant remains transparent, debuggable, cost-efficient, and continuously improvable as it scales.