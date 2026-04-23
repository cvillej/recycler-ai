# external-event-controller.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

This document describes the External Event Controller layer — the control plane responsible for handling all non-user input, enforcing hard controls, resolving user plans, and enabling proactive behavior.

## Purpose of the External Event Controller

The External Event Controller is the **nervous system** of the AI Yard Assistant. It:

- Ingests events from external and internal systems
- Resolves and enriches user context (permissions, features, quotas)
- Performs hard enforcement before any request reaches the LLM
- Injects structured events into conversations to drive proactivity
- Coordinates with aiproxy for final LiteLLM-level budgeting and access enforcement

It keeps the core reasoning loop (TS Resolver + prompt + LLM) clean by handling control and external reactivity separately.

## Core Components

### 1. Event Worker (Background / Async)

The Event Worker is the primary consumer of external events. Its responsibilities include:

- Listening to webhooks, queues, and cron jobs from external systems
- Updating business state in the Data Layer
- Creating structured system/event messages and appending them to conversations
- Optionally triggering proactive assistant turns
- Invalidating Redis caches when state changes

### 2. Context Enricher (Synchronous Middleware)

Runs early in every incoming request (before the TS Resolver). It:

- Loads the current user session and `user_id`
- Resolves the 5-level permission cascade
- Builds the resolved `user_plan` snapshot
- Patches the enriched data into `ThreadContext`
- Performs initial hard checks

### 3. Permission Cascade Resolver

The deterministic logic engine inside the Context Enricher that merges the 5 levels in strict order.

## 5-Level Permission Cascade

**Cascade Order (Highest to Lowest Precedence)**

1. Policy (Org/Enterprise)
2. Feature Flags
3. Local / Yard-specific
4. Project / Session
5. User

The Context Enricher resolves the cascade, computes `effective_features` and `token_monthly_remaining`, and produces a clean `user_plan` snapshot. Hard enforcement (feature not allowed or quota exhausted) happens early. Final hard budgeting and account-level enforcement is delegated to LiteLLM inside aiproxy.

## Event Ingestion & Structured Messages

Events can arrive through **passive** (webhooks, queues, cron) and **active** (REST endpoints) channels. Internal systems can programmatically push events via endpoints such as `POST /events/auction-update` or `POST /events/plan-change`.

### Processing Steps

1. Validate and normalize the payload
2. Update relevant business state
3. Determine affected `contextId`(s)
4. Create a structured event message
5. Append it to conversation history
6. Optionally trigger a proactive turn
7. Invalidate relevant Redis caches

### Structured Event Messages

All non-user injected events use `role: "tool"` with a descriptive `name`:

```json
{
  "role": "tool",
  "name": "auction_loss",
  "content": "Lost auction on 2019 Ford F-150 (Lot #C-48219)",
  "metadata": {
    "event_type": "auction_loss",
    "source": "copart_webhook",
    "contextId": "...",
    "vehicle_id": 12345,
    "effective_features": ["proactive_bidding"],
    "token_monthly_remaining": 412000,
    "action": "notify"
  }
}
```

This structure clearly separates external events from true system instructions and supports future A2A compatibility.

## Proactive Behavior

The External Event Controller enables timely proactive updates.

When the Event Worker processes an event, it evaluates importance using business rules and user preferences. If actionable, it:

- Appends a structured event message (`role: "tool"`)
- Optionally triggers a proactive assistant turn (marked with **[Proactive Update]**)
- Routes it through the normal pipeline (Context Enricher → TS Resolver → prompt → aiproxy)

**Examples** include auction loss notifications, aging inventory alerts, and quota warnings.

**Safeguards** include cooldowns, user opt-out, and respect for `effective_features`.

## Caching & Invalidation Strategy

ThreadContext and User Plans are aggressively cached in Redis to provide low-latency access for the TS Resolver and prompt assembly.

### Caching Approach

- **ThreadContext** → Cached under key `thread_context:{contextId}`
- **User Plans** → Cached under key `user_plan:{user_id}`

Both use Redis as the primary fast path, with Postgres as the durable source of truth.

### Invalidation Responsibility

Cache invalidation follows a **distributed responsibility** model:

Any component that modifies `ThreadContext` or `user_plan` is responsible for immediately invalidating (or updating) the corresponding Redis cache entry.

**Primary writers and their responsibilities:**

- **Post-response handler** (main chat flow) — Updates `ThreadContext` after each LLM turn and invalidates the cache.
- **Context Enricher** — Updates resolved `user_plan` and invalidates the user plan cache.
- **Event Worker** — Updates `ThreadContext` or business state that affects context and performs cache invalidation.

A short TTL is used as a safety net in case invalidation is missed.

## Integration Points

The External Event Controller integrates with:

- **Data Layer**: Reads/writes `thread_context`, `conversation_messages`, business tables, `user_plans`, and `usage_ledger`.
- **Request Flow**: Context Enricher runs early in every chat request and feeds enriched `ThreadContext` to the TS Resolver.
- **Prompt Management**: Provides variables for prompt compilation.
- **Tool Layer**: Influences tool selection via enriched context.
- **aiproxy**: Provides resolved user plan data for LiteLLM hard budgeting and access enforcement.
- **Observability**: All events and proactive turns are fully traced in Langfuse under the same `contextId`.

This layer ensures clean separation between external reactivity/control logic and core agent reasoning.
