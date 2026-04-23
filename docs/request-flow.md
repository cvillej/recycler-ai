# request-flow.md
**Version:** April 20, 2026  
**Status:** Complete (Zoom Level 2)

This document defines the complete request flow for the AI Yard Assistant, including how incoming requests (from UI or programmatic sources) are processed, enriched, resolved, and how responses + side effects are handled.

## Purpose of Request Flow

The Request Flow is the central orchestration layer that ties together all other components. It is responsible for:

- Receiving and authenticating all incoming messages (UI, programmatic scripts, Event Worker, etc.)
- Building and enriching the `ThreadContext`
- Resolving prompts, tools, features, and behavior
- Executing the LLM call via aiproxy/LiteLLM
- Handling post-response actions safely (memory, summarization, async injection, notifications)
- Supporting both normal chat and **programmatic / headless** message injection

This flow ensures consistency whether a message comes from the UI or from a script/external system.

## High-Level Flow

Every request follows this sequence:

1. **Request Ingestion** → Chat Transport receives the message (via REST, WebSocket, or internal call)
2. **Authentication & Authorization** → Validate user/session and permissions
3. **ThreadContext Construction** → Load or create `ThreadContext` for the `contextId`
4. **Context Enrichment** → Context Enricher runs (user_plan, effective_features, recent events, entity resolution, focus_state, pivot detection)
5. **Prompt Resolution** → TS Resolver builds the final prompt + tool list (or Skill)
6. **LLM Execution** → Call aiproxy/LiteLLM with the resolved prompt
7. **Post-Response Handling** → Update memory, trigger summarization/compaction/checkpoints, handle async injections, send notifications
8. **Response Delivery** → Return response to caller (UI or script)

## Programmatic / Headless Message Injection

The system supports sending messages **programmatically** without going through the UI. This is a first-class capability.

**Endpoint:**
`POST /api/chat/{contextId}/messages`

**Supported Roles:**
- `user`
- `system`
- `tool`
- `assistant` (rare, mostly for replay)

**Example Payload:**
```json
{
  "role": "system",
  "content": "Copart auction #C-48219 just closed. You were outbid.",
  "metadata": {
    "source": "event_worker",
    "message_type": "system_notification",
    "labels": ["auction", "external_injection"],
    "importance_score": 0.9,
    "job_id": "job_abc123"
  }
}
```

**Behavior:**
- The message is treated exactly like any other message in the flow.
- It goes through Context Enrichment, Prompt Resolution, and Post-Response Handling.
- It is stored in `conversation_messages` with the correct `message_type` and metadata.
- Memory management, summarization, and compaction handle it intelligently based on labels and importance_score.
- Observability logs it with full traceability.

This makes it safe to inject async results, external notifications, or test messages without corrupting normal chat flow.

## ThreadContext

`ThreadContext` is the single source of truth that flows through the entire request.

It contains:
- `contextId`
- `user_id`, `yard_id`, `session_id`
- `user_plan` (including `effective_features`)
- `memory_summary` and `structured_memory`
- `recentEvents`, `resolvedEntities`, `pinnedFacts`
- `focus_state`, `pivot_detected`

It is loaded early and enriched before prompt resolution.

## Context Enricher

Runs as part of the External Event Controller. Responsibilities:
- Resolve `effective_features` via the 5-level cascade
- Inject recent external events
- Perform entity resolution
- Detect `focus_state` and `pivot_detected`
- Patch the enriched data into `ThreadContext`

## TS Resolver (Prompt Resolution)

Receives `PromptResolutionInput` and produces the final prompt + tool/Skill list.

Key responsibilities:
- Select appropriate prompt template
- Apply dynamic variables (memory, events, entities, user_plan)
- Filter and guide tools/Skills based on `effective_features`
- Generate context-aware guidance

## LLM Execution

- All LLM calls go through **aiproxy/LiteLLM**
- Includes cost tracking, prefix caching, and budget enforcement
- Virtual keys are used for per-contextId budgeting

## Post-Response Handler

After the LLM returns:

1. Store the assistant message
2. Update memory (`memory_summary`, `structured_memory`)
3. Trigger summarization/compaction if needed
4. Handle pivot detection and pivot_pipeline
5. Create checkpoints when appropriate
6. Process any async task completions or external injections
7. Invalidate caches
8. Log full trace to Langfuse

This handler ensures memory stays coherent and async injections are handled safely.

## Dev-Mode Annotations

In development mode only (`NODE_ENV === 'development'`), the system supports attaching **annotations** to messages. This feature helps developers add notes, flags, or observations directly to a conversation that are then included in the Langfuse trace.

### How It Works

- The UI exposes an "Add Annotation" option next to messages when running in dev mode.
- Annotations are sent as optional metadata on the message payload.
- The backend only accepts and processes annotations when the request is flagged as coming from a development environment.
- Annotations are **never stored** in the main `conversation_messages` table in production.
- In development, annotations are attached as custom metadata to the corresponding Langfuse trace and observations.

**Example Payload (dev only):**
```json
{
  "role": "assistant",
  "content": "...",
  "annotations": [
    {
      "type": "note",
      "text": "This response hallucinated the part serial number",
      "author": "dev-user",
      "timestamp": "2026-04-22T10:15:00Z"
    },
    {
      "type": "flag",
      "text": "Bad entity resolution",
      "severity": "medium"
    }
  ]
}
```

### Integration with Tracing

- Annotations appear as structured metadata in Langfuse traces.
- When a trace is pulled (`task trace:pull <traceId>`), the exported JSON includes the `annotations` array for each message.
- This makes debugging and trace replay significantly more useful, as developer context travels with the trace.

Annotations are stripped at the gateway level in production, ensuring zero impact on performance or data model in live environments.


## Non-Functional Properties

- **Consistency** — Programmatic and UI messages follow the exact same path
- **Safety** — Hard enforcement (features, quotas, canonical ID gates) happens before LLM calls
- **Observability** — Every step is fully traced with `contextId`
- **Extensibility** — New message types and injection sources can be added easily

This request flow is the nervous system of the application and supports both interactive chat and powerful programmatic/automated use cases.

