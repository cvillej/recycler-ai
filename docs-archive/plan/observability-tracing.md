Observability-Tracing-Plan.md
Reference: Master-Implementation-Plan.md

Purpose
Unified observability is mission critical for a safe, maintainable, and explainable agent system.
This section ensures every important event, branch, output, and error is recordable, traceable, and can be reviewed across:

System-wide traces (OpenTelemetry/OTel)
Rich agent path/debugging (LangSmith)
Structure logs for automation, alerting, and postmortems
Scope
Observability is embedded across ALL layers—agent state, prompts, router, orchestration, tools, transport, and UI.
OTel instrumentation and LangSmith event streams must correlate via ids (trace, span, agent run, etc.).
No critical action is hidden from logs by design; all infrastructure respects privacy/redaction rules.
Explicit Implementation Requirements
1. Instrumentation Setup
🟦 AGENT:

OTel must be initialized for your app (e.g., instrumentation.ts in Next.js; registerOTel({ serviceName })).
LangSmith instrumentation enabled in agent graph, with environment-based config for dev/prod.
Every function of interest (router decision, prompt execution, tool invocation, state change, interrupt, API req/res) emits a trace span/event at the appropriate level.
🟨 HUMAN:

Ensure OTel exports/trace drains are configured for each project env (dev, preview, prod).
Sampling and privacy rules must be followed as in tracing-approach.md.
2. Trace & Log Structure
🟦 AGENT:

Each log/trace/span must always include:
trace_id, span_id, and/or LangSmith run_id
Request/session/user/thread context (redacted as needed)
Event type (router.decision, prompt.exec, tool.result, etc)
Decision/reason field: always log why a branch or action was taken
Use consistent log levels: INFO (normal step), WARN (degraded fallback), ERROR (unexpected/failure), DEBUG (dev/sampled only).
🟨 HUMAN:

All logs must be machine consumable (JSON/structured), not just console lines.
Never log full sensitive payloads in prod (see below).
3. Correlation & Ownership
🟦 AGENT:

All agent-run logs correleate by trace id, and prompt-to-tool-to-UI cycle always follows same ID chain.
Each workflow (e.g. a chat turn, a tool sequence) is uniquely traceable and explorable after the fact.
🟨 HUMAN:

Privacy and compliance require all logs to redact or hash user PII, secret keys, auth data.
4. Redaction & Sampling Policy
🟦 AGENT:

Redact or hash all secrets, sensitive context, prompt text and tool payloads unless in DEV or sampled/troubleshooting mode.
Sampling config:
100% of errors
10-20% of healthy prod
100% of new deployments/canaries
5. Trace/Log Enrichment and Tags
🟦 AGENT:

Add high-context tags to each span/log:
Workflow step (chat.turn, router.decision, prompt.classify_intent, etc)
State summary (intent, pivot, tool, widget type, etc)
Branch reason/ID
Add OTel/GenAI conventions (app.*, http status, tool_name, pivot_detected, checkpoint_version, etc)
6. LangSmith-Specific Instrumentation
🟦 AGENT:

Every prompt, tool run, router decision, and graph transition is logged to LangSmith with:
node start/end
input/output summary (never full private user data in prod)
state diff summary
branch/fallback decision
Use LangSmith’s environment variable setup so traces do not “break” on short serverless runs.
🟨 HUMAN:

Ensure that trace runs in LangSmith are tagged to deployment hash/branch, environment, etc for A/B regtest.
7. UI & Playground Feedback
🟦 AGENT:

Pipe trace/debug data and error/wait states (as contract fields) to the UI and admin Playgrounds for full lifecycle visibility.
Do not expose low-level system trace ids to users, but provide explicit feedback (“agent waiting for approval”, “rerunning with fallback plan X”, etc).
8. Test Vectors & Monitoring
🟦 AGENT:

Unit/integration tests must check that trace/context/log fields are present and correct for:
Normal agent steps
Error cases
Interruptions/approval cycles
🟨 HUMAN:

Review monitoring dashboards/trace trees regularly, esp. after prompt/graph/infra updates.
9. Good / Bad Practice Callouts
Good:

Every agent branch/step is explainable after the fact via traces/logs
Redaction and privacy enforced per environment
Ingest/export to OTel/ELK/Sentry/SIEM works out of the box for all layers
Trace/decision logs sampled into LangSmith for agent evolution and prompt A/B evaluation
Bad:

Decisions made in “black box” code, logs missing branch/reason/context
No trace-correlation between frontend, backend, and agent
Prompts or tool calls directly leak PII or credential data to logs in prod
10. Links/References
Master-Implementation-Plan.md
tracing-approach.md
LangGraph-Orchestration-Plan.md
Chat-Transport-API-Plan.md
