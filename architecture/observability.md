# observability.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

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

## Core Principles

1. **contextId as the Universal Session Key** — Every trace, log, metric, and event is tied to a single `contextId` (formerly `thread_id`).
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

All other tools (Postgres logs, Redis metrics, OpenSearch, aiproxy/LiteLLM logs) feed into or are correlated with Langfuse.

## What Gets Traced

Every major component emits traces and events:

### Request Flow
- Full request lifecycle (ingestion → enrichment → resolution → LLM call → post-response)
- `PromptResolutionInput` and `PromptResolutionOutput` (including final prompt and tool list)
- Token count, latency, model used, cache hit/miss
- `effective_features` at time of request

### Memory Management
- Summarization triggers and outcomes
- Compaction cycles (phases, tokens saved, items pruned)
- Pivot detection and pivot_pipeline execution
- Checkpoint creation
- Memory decay and pruning decisions

### Feature Management
- `effective_features` resolution (which features were granted/denied and why)
- Permission cascade evaluation
- Quota checks and exhaustion events

### Tool Layer
- Tool selection and filtering (hard + soft enforcement)
- Tool call success/failure with full input/output
- Entity resolution results (canonical ID, confidence, alternatives considered)

### External Event Controller
- Event ingestion (source, type, payload summary)
- Context Enricher decisions
- Notification dispatch (type, channel, priority, delivery status)

### HITL & Failures
- Every failure (hard/soft/quota) with category, confidence, and resolution
- HITL interactions (proposal, user decision, outcome)
- Asynchronous notification triggers and delivery

### Background Jobs
- Long-running report generation
- Scheduled compaction / Auto Dream-style memory consolidation
- Data sync jobs (inventory, market data)

All traces include `contextId`, `user_id`, `yard_id`, `focus_state`, and `timestamp` for easy correlation.

## Decision Traceability & Configurable Observability

One of the most important responsibilities of observability is **explainability**: being able to answer "Why did the system make this decision?" and "What input and output did it produce?"

This is not just nice-to-have — it is essential for debugging, auditing, compliance, user trust, and continuous improvement.

### Decision Traceability Standard

Every important decision in the system **must** log the following four fields as structured attributes:

| Field            | Description                                                                 | Example |
|------------------|-----------------------------------------------------------------------------|---------|
| `decision`       | What was decided                                                              | `"grant_feature:proactive_bidding"` or `"select_tool:get_part_details"` |
| `reason`         | Why the decision was made                                                     | `"low_confidence_entity_resolution"` or `"user_in_active_bidding_session"` |
| `input`          | The key data considered (structured, redacted if needed)                      | `{ "entity_candidates": 3, "top_confidence": 0.67, "focus_state": "auction_bidding_session" }` |
| `output`         | What was produced as a result of the decision                                 | `{ "canonical_id": null, "action": "ask_for_clarification", "options_presented": 3 }` |

These four fields are attached to every relevant span in Langfuse as structured attributes. This allows powerful queries such as:

- "Show me all decisions where `decision = 'hitl_trigger'` and `reason` contains 'low_confidence'"
- "Find all cases where `entity_resolver` output a `canonical_id` of `null`"
- "Compare input vs output for all `prompt_resolution` decisions in the last 7 days"

### Component Tagging

Every span is tagged with a `component` attribute so we can filter and configure observability by subsystem:

- `entity_resolver`
- `prompt_resolution`
- `tool_layer`
- `memory_compaction`
- `context_enricher`
- `external_event_worker`
- `post_response_handler`
- `hitl_gate`
- `quota_enforcer`

This enables component-specific verbosity (see below).

### Configurable Observability (Like Logging Levels, But Better)

We support three levels of control, inspired by traditional logging but adapted for AI systems:

1. **Global Level** (default)
   - `error` — Only hard failures and critical issues
   - `warn` — Hard failures + quota exhaustion + important notifications
   - `info` — All decisions + soft failures + normal operation (default for production)
   - `debug` — Full input/output, latency details, internal state (used during development or incident investigation)

2. **Per-Component Level** (overrides global)
   - Example configuration:
     - `entity_resolver = debug` (we want full visibility into resolution logic)
     - `hard_failures = warn` (always capture these)
     - `latency = info` (we care about p95, but not every span)
     - `memory_compaction = info` (we want to see when it runs and what it saves)

3. **Dynamic Sampling**
   - 100% sampling for `error` and `warn` events
   - 10% sampling for normal `info` traces
   - 1% sampling for `debug` traces (to control cost and noise)
   - Configurable per component and per `focus_state` (e.g. higher sampling during `auction_bidding_session`)

This model gives us **maximum explainability when we need it** and **controlled noise** when we don't.

### Privacy & Redaction

All structured attributes go through a redaction layer before being sent to Langfuse:

- User PII (email, phone, full name) is hashed or removed.
- Sensitive business data (exact prices, internal margins, competitor data) is redacted or summarized.
- Full raw payloads are stored only when explicitly needed (e.g. during incident investigation) and are automatically purged after 30 days unless flagged.

### Implementation

- The TS Resolver, Context Enricher, Tool Layer, Memory Manager, and Event Worker all use a shared **Observability SDK** that enforces this standard.
- Every span automatically includes `contextId`, `user_id`, `yard_id`, `focus_state`, `effective_features`, and `timestamp`.
- Configuration is managed centrally (via environment variables + Langfuse project settings) so changes can be made without code deployment.

This approach ensures we always have the "why" and "what" for every decision, while keeping observability practical and cost-effective at scale.

## Metrics & KPIs

We track a focused set of metrics that matter for business outcomes, system health, and product improvement.

### Core Business Metrics

- **Conversation Success Rate** — % of conversations that end with user satisfaction (thumbs up or explicit positive feedback)
- **HITL Resolution Rate** — % of HITL interactions that result in successful continuation (vs abandonment)
- **Quota Exhaustion Conversion Rate** — % of users who upgrade or purchase more tokens after hitting limit
- **Proactive Value Delivered** — % of proactive notifications that lead to user action (e.g. opened bidding session, adjusted bid)
- **Feature Adoption Rate** — % of users who use each major feature (auction_alerts, proactive_bidding, inventory_visibility, etc.)

### System Health Metrics

- **Request Latency (p50, p95, p99)** — End-to-end time from user message to final response
- **LLM Latency** — Time spent in model inference (by model)
- **Tool Success Rate** — % of tool calls that succeed on first attempt
- **Entity Resolution Accuracy** — % of entity resolutions with confidence > 0.85 that are confirmed correct by user
- **Soft Failure Resolution Rate** — % of soft failures resolved without user abandoning the conversation
- **Hard Failure Rate** — % of requests that hit a hard failure (by category)

### Cost & Efficiency Metrics

- **Tokens per Conversation** (average and distribution)
- **Cost per Conversation** (by model and feature)
- **Cache Hit Rate** — % of prompt prefix cache hits (xAI / LiteLLM prefix caching)
- **Summarization / Compaction Savings** — Average tokens saved per conversation due to memory management
- **Background Job Cost** — Cost of compaction, report generation, and other async jobs

### Observability Health Metrics

- **Trace Coverage** — % of requests that have a complete Langfuse trace
- **Event Delivery Success Rate** — % of notifications successfully delivered (by channel)
- **Log Completeness** — % of expected events that were actually logged

All metrics are sliced by:
- `user_plan` tier
- `focus_state`
- `yard_id` (for multi-yard analysis)
- Time of day / day of week

## Dashboards & Alerts

Observability is only valuable if the right people can see the right information at the right time.

### Core Dashboards (Langfuse + Custom)

**1. Executive Dashboard**
- Daily/weekly active users
- Conversation volume and success rate
- Feature adoption trends
- Cost per conversation and total spend
- Quota exhaustion and conversion rate

**2. Operations Dashboard**
- Real-time request volume and latency (p50/p95/p99)
- Hard failure rate by category
- Tool success rate
- Background job health (compaction, report generation, data sync)
- Notification delivery success rate

**3. Product & AI Quality Dashboard**
- Entity resolution accuracy and clarification rate
- HITL acceptance/rejection/modification rates
- Soft failure resolution rate
- Prompt and tool usage patterns
- Memory compaction savings (tokens saved)

**4. Cost & Performance Dashboard**
- Token usage by user tier, focus_state, and model
- Cache hit rate and cost savings
- Per-feature cost breakdown
- Background job cost trends

**5. Failure & Incident Dashboard**
- Hard vs soft failure breakdown
- Top failing components and external systems
- Time-to-resolution trends
- Quota exhaustion events and conversion funnel

All dashboards support filtering by `contextId`, `user_id`, `yard_id`, `focus_state`, and time range.

### Alerting Rules

We use a combination of Langfuse alerts + external alerting (PagerDuty / Slack / Email) for the following conditions:

**Critical (Page on-call immediately)**
- Hard failure rate > 5% for 5+ minutes
- External system outage (Copart, IAAI, Stripe, etc.) detected
- Database or cache unavailability
- Langfuse trace ingestion failure

**Warning (Notify operations + relevant team)**
- p95 latency > 8 seconds for 10+ minutes
- Tool success rate < 90% for 15+ minutes
- Quota exhaustion rate > 15% of active users in last hour
- Background job failure rate > 10%

**Info (Daily digest or on-demand)**
- New failure pattern detected (clustering of similar soft failures)
- Feature adoption drop > 20% week-over-week
- Memory compaction savings below expected threshold

Alert routing is component-aware:
- `entity_resolver` issues → AI/ML team
- `tool_layer` / external integration issues → Platform + relevant integration owner
- Quota / billing issues → Growth + Finance
- General system health → Operations

## Integration Points

Observability is not a separate system — it is deeply embedded in every layer of the architecture.

### Request Flow
- Every request creates a root trace in Langfuse with `contextId` as `session_id`.
- The TS Resolver logs full `PromptResolutionInput` → `PromptResolutionOutput` (including final prompt, tool list, and decision reasoning).
- Post-Response Handler logs all memory updates, summarization triggers, compaction runs, checkpoint creation, and notification dispatch.

### External Event Controller
- Event Worker creates a trace for every incoming event (with `source`, `event_type`, and `importance_score`).
- Context Enricher logs all enrichment decisions (user_plan resolution, recent events injected, focus_state changes, pivot detection).

### Memory Management
- Summarization and compaction jobs create dedicated traces with input size, output size, tokens saved, and items pruned.
- Pivot detection and pivot_pipeline execution are logged with before/after state.
- Checkpoint creation includes the full `ThreadContext` snapshot (redacted).

### Feature Management
- Every `effective_features` resolution is logged with the final array, which features were granted/denied, and the cascade path that led to the result.
- Quota checks and exhaustion events are logged with current usage and limit.

### Tool Layer
- Every tool call is logged as a child span with full input, output (or error), latency, and success/failure.
- Entity resolution results include canonical ID, confidence, alternatives considered, and final user selection (if HITL was triggered).

### aiproxy / LiteLLM
- All LLM calls are traced with model, prompt tokens, completion tokens, cost, cache status, and latency.
- Prefix cache hits/misses are explicitly logged.

### Background Jobs
- Long-running jobs (report generation, bulk valuation, data sync) create their own traces and update the parent `contextId` trace when complete.
- Scheduled jobs (compaction, Auto Dream-style memory consolidation) run as independent traces with full metrics.

All layers use the shared **Observability SDK**, which enforces the Decision Traceability Standard (decision / reason / input / output) and component tagging.

## Cost & Token Tracking

Cost visibility is critical for both operational efficiency and business decision-making.

### What We Track

- **Per-Request Cost** — Total cost (input + output tokens × model price) for every LLM call, attributed to `contextId` and `user_id`.
- **Per-Conversation Cost** — Sum of all LLM calls + tool calls + background job costs within a `contextId`.
- **Per-User / Per-Yard Cost** — Monthly and daily spend by user and yard.
- **Per-Feature Cost** — Cost breakdown by `focus_state` and feature (e.g. cost of `proactive_bidding` vs `inventory_visibility` sessions).
- **Cache Savings** — Estimated cost saved by prefix caching (xAI / LiteLLM) and memory summarization/compaction.
- **Background Job Cost** — Separate tracking for compaction, report generation, data sync, and other async workloads.

### Cost Attribution

Every cost event includes:
- `contextId`
- `user_id`
- `yard_id`
- `focus_state`
- `model` (or `job_type` for background jobs)
- `tokens_input`, `tokens_output`, `cost_usd`

This enables accurate per-user billing, feature profitability analysis, and anomaly detection (e.g. a single user suddenly consuming 10× normal tokens).

### Alerts & Controls

- Real-time alert when a single `contextId` exceeds a configurable cost threshold (e.g. $5 in one conversation).
- Daily/weekly spend alerts by user tier and yard.
- Automatic soft-blocking of high-cost features when budget is low (configurable per plan).

## Privacy & Data Retention

Observability must balance visibility with privacy and compliance.

### Data Redaction

All structured attributes and logs pass through a redaction layer before storage:

- **PII** (email, phone, full name, address) → Hashed or removed
- **Sensitive business data** (exact competitor prices, internal margins, customer lists) → Redacted or summarized
- **Full raw payloads** (e.g. complete tool input/output) → Stored only when needed for incident investigation; automatically purged after 30 days unless flagged

### Retention Policy

| Data Type                    | Retention Period | Notes |
|-----------------------------|------------------|-------|
| Full traces (Langfuse)      | 90 days          | Standard operational retention |
| Decision attributes         | 90 days          | Structured `decision` / `reason` / `input` / `output` |
| Cost & token events         | 13 months        | Required for financial reporting |
| Hard failure logs           | 13 months        | Compliance and post-mortem |
| Debug-level traces          | 7 days           | High-volume, short-term only |
| Notification delivery logs  | 90 days          | Audit trail for user communications |

### Compliance

- All observability data is stored in the same region as the primary application (for data residency).
- Langfuse project-level access controls ensure only authorized teams can view traces.
- Automated PII scanning and redaction is enforced at the SDK level.
- Users can request export or deletion of their observability data (subject to legal hold).

## Extensibility

Observability must evolve with the system. The design supports easy addition of new components, metrics, and tracing needs.

### Adding New Components

To add observability for a new component (e.g. a new SME agent or background service):

1. Register the component name in the central Observability SDK config.
2. Use the standard `startSpan(component, decision, reason, input, output)` helper.
3. All Decision Traceability fields and component tagging are applied automatically.
4. New metrics can be added via Langfuse custom metrics or exported to Prometheus/Grafana.

No changes to core tracing infrastructure are required.

### Adding New Metrics or Attributes

New attributes or metrics can be added at any time by:
- Defining the attribute name and type in the shared schema.
- Emitting it from the relevant component.
- Updating dashboards and alerts as needed.

Because all data is structured and queryable in Langfuse, new fields become immediately usable for filtering, aggregation, and visualization.

### Future Evolution

As the system moves toward multi-agent SME decomposition, observability will support:
- Cross-agent trace correlation (parent `contextId` + child agent traces)
- Agent-specific dashboards and metrics
- Comparative analysis (e.g. "How does Auction Intelligence Agent performance compare to Inventory Agent?")
- Predictive alerting based on learned failure patterns

The foundation built here supports all of these without requiring a redesign.

## Summary

Observability in the AI Yard Assistant is a first-class, deeply integrated capability that provides:

- **Full Decision Traceability** — Every important decision logs `decision`, `reason`, `input`, and `output` with rich structured attributes.
- **Configurable Verbosity** — Global and per-component levels (error / warn / info / debug) with dynamic sampling.
- **Universal Context** — Every trace, metric, and event is tied to `contextId`, `user_id`, `yard_id`, and `focus_state`.
- **Business + Technical Metrics** — We measure what matters for users, cost, reliability, and product improvement.
- **Proactive Alerting** — Real-time detection of issues with clear ownership and escalation paths.
- **Privacy by Design** — Strong redaction, retention policies, and access controls.
- **Extensibility** — Easy to add new components, metrics, and agents without infrastructure changes.

This observability system ensures the AI Yard Assistant remains transparent, debuggable, cost-efficient, and continuously improvable as it scales from single-agent to multi-agent operation.
