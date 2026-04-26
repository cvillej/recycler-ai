# architecture.md
**Version:** April 26, 2026  
**Status:** Updated (Zoom Level 1) — Phase 0 Scope Applied + Phone as First-Class Channel

This is the highest-level entry point for the AI Yard Assistant architecture. All other documents exist at Zoom Level 2 or deeper. This document explains the **overall system design**, **how the major subsystems interact**, and **why we made the key architectural decisions**.

## Purpose

The AI Yard Assistant is a **hybrid conversational + event-driven intelligent agent** built specifically for salvage yard operators. It combines:

- A powerful multi-channel conversational interface (**chat, phone/voice**, and programmatic)
- Proactive intelligence (notifications, recommendations, alerts)
- Background automation (Inngest workflows, HITL orchestration)
- Rich, real-time UI updates (widgets, badges, state)

Its primary goal in **Phase 0** is to deliver clear, immediate ROI through **inventory intelligence, valuation, pricing recommendations, aging inventory detection, and profitability insights**.

## Core Philosophy

The architecture is built on a small number of non-negotiable principles:

1. **Hard Enforcement Before Reasoning** — Features, quotas, permissions, and safety checks (including canonical ID gates) happen **before** any LLM call.
2. **contextId as the Universal Key** — Every conversation, trace, memory item, notification, and background job is tied to a single `contextId`.
3. **ThreadContext as the Runtime Snapshot** — A lightweight, aggressively cached object that carries everything the agent needs to reason correctly.
4. **Memory, Events, and Notifications are First-Class** — These are not afterthoughts; they are core to how the system behaves intelligently.
5. **Mature Tools as Implementation Details** — We use best-in-class tools (Supabase, Inngest, Knock, Supabase Realtime, Langfuse, LangGraph, Mem0) under a clean abstraction layer so we maintain long-term coherence and elegance.
6. **Full Observability by Default** — Every decision, failure, notification, and background job is traceable in Langfuse.
7. **Clean Separation of Concerns** — Control Plane (enforcement, routing, orchestration) is strictly separated from Reasoning Plane (prompt resolution + LLM).

## How the System Works: "How It All Fits Together"

At the highest level, the system has two main flows that constantly interact:

### 1. Request Flow (Conversational Path)
This is the **synchronous** path when a user (or script) sends a message.

```
User / Script
   ↓
Request Ingestion (REST / WebSocket / Programmatic)
   ↓
Authentication + DevAuthService
   ↓
ThreadContext Load + Context Enricher
   ↓
TS Resolver (prompt_resolution + tool/Skill selection)
   ↓
aiproxy / LiteLLM (LLM call)
   ↓
Post-Response Handler
   ↓ (parallel)
   ├── Memory Update + Summarization / Compaction
   ├── Inngest Workflow Trigger (if needed)
   ├── NotificationService (Knock for rich/HITL, Supabase Realtime for updates)
   └── Response returned to caller
```

### 2. Event-Driven Path (Proactive + Background Path)
This is the **asynchronous** path triggered by external systems, timers, or long-running jobs.

```
External System / Cron / Inngest Schedule
   ↓
Inngest Function (durable execution)
   ↓
Event Worker
   ↓
Data Layer Update (Supabase)
   ↓
Context Enricher (if user is active)
   ↓
NotificationService Decision
   ↓ (routes to)
   ├── Knock (rich notification + deep link + HITL)
   └── Supabase Realtime (widget / badge updates)
   ↓
Inngest "wait for event" (if HITL required)
   ↓
User responds via deep link
   ↓
Inngest resumes → Result injected into conversation
```

These two paths are deliberately **tightly coupled** through:
- Shared `contextId`
- `ThreadContext`
- `NotificationService`
- Inngest as the durable backbone
- Langfuse as the single source of truth for observability

## Control Plane vs Reasoning Plane

This is one of the most important architectural distinctions in the system.

| Plane            | Responsibility                              | Key Components                          | Must Be Fast & Reliable? |
|------------------|---------------------------------------------|-----------------------------------------|--------------------------|
| **Control Plane**    | Enforcement, routing, orchestration, safety | Context Enricher, NotificationService, Inngest, DevAuthService, Quota Enforcer | **Yes** |
| **Reasoning Plane**  | Understanding intent, tool selection, generation | TS Resolver, Prompt Resolution, LLM (via aiproxy), LangGraph Skills | **Yes** |

**Why this separation matters:**
- The Control Plane can evolve independently (e.g., adding new notification channels or changing enforcement logic).
- The Reasoning Plane stays clean and focused on intelligence.
- Failures in one plane do not cascade into the other.

## Major Subsystems (Zoom Level 2)

| Document                        | Purpose                                                                 | Key Interactions |
|--------------------------------|--------------------------------------------------------------------------|------------------|
| [data-layer.md](./data-layer.md) | Hybrid model: Supabase (agent data) + Thin API layer (business data)    | Used by almost every component |
| [request-flow.md](./request-flow.md) | Full synchronous request pipeline + programmatic injection              | Core of the Reasoning Plane |
| [external-event-controller.md](./external-event-controller.md) | Inngest-powered event ingestion, Context Enricher, proactive behavior   | Bridges external world into the system |
| [prompt-management.md](./prompt-management.md) | Dynamic prompt resolution + tool/Skill guidance                         | Heart of the Reasoning Plane |
| [tool-layer.md](./tool-layer.md) | Tool execution + LangGraph Skills (encapsulated)                        | Called by TS Resolver |
| [memory-management.md](./memory-management.md) | Summarization and structured memory management                          | Runs in Post-Response Handler |
| [failure-mode-and-hitl.md](./failure-mode-and-hitl.md) | Graceful degradation, Mandatory Clarification Gates, HITL patterns      | Deep integration with Request Flow + Inngest + Knock |
| [notification-strategy.md](./notification-strategy.md) | Hybrid routing: Knock (rich/HITL) + Ably (realtime)                     | Used by Post-Response Handler + Event Worker |
| [observability.md](./observability.md) | Langfuse tracing, Decision Traceability Standard, metrics               | Cross-cuts every component |
| [permissions.md](./permissions.md) | Feature gating, subscription tiers, usage quotas, trials, and upgrade paths | Core business capability — resolved early in Context Enricher |
| [development-env.md](./development-env.md) | Local development setup, Cursor + LLM workflow, logging strategy        | Developer productivity |
| [ui-layer.md](./ui-layer.md) | Next.js + Expo + Widget system + Supabase Realtime                      | Consumes ThreadContext + Supabase Realtime updates |

## Key Technology Decisions + Rationale

| Decision                    | Choice                          | Rationale |
|----------------------------|----------------------------------|---------|
| **Database**               | Hybrid: Supabase (agent data) + Thin API layer (business data) | Best local dev experience + minimal dependency on legacy production DB |
| **Realtime**               | **Supabase Realtime** (not Ably) | Already in stack, simpler integration, good enough for Phase 0, lower cost and complexity |
| **Background Jobs + HITL** | **Hybrid (Inngest + pg-boss)**  | Inngest for complex/HITL workflows; pg-boss (Postgres queue) for simple/scheduled jobs. Accessed via `BackgroundJobService` abstraction |
| **Rich Notifications**     | **Knock**                       | Best-in-class workflow engine, deep links, user preferences, delivery tracking, closed-loop HITL |
| **Observability**          | **Langfuse**                    | Purpose-built for LLM apps, excellent trace replay, cost tracking, prompt versioning |
| **Memory**                 | **Mem0**                        | Primary memory engine for structured memory, 3-level focus, workflow state, and long-term recall |
| **Skills**                 | **LangGraph** (only for Skills) | Encapsulated deterministic multi-tool graphs. Main agent stays custom for maximum control |
| **Main Agent Loop**        | Custom TS Resolver + `prompt_resolution` | Full control over prompt engineering, tool guidance, and feature enforcement |
| **Auth Abstraction**       | **DevAuthService**              | Clean abstraction so we can swap Supabase Auth later without major refactors |

These choices give us **excellent velocity in Phase 0** while preserving **long-term architectural coherence and elegance**.

## Phase 0 Scope

**In Scope:**
- Inventory intelligence, valuation, and profitability insights
- Aging inventory detection and recommended actions
- Proactive notifications and recommendations via Knock + Supabase Realtime
- Strong conversational agent with `focus_state` awareness
- HITL for high-impact decisions (bidding limits, pricing changes, etc.)
- Full observability and memory management

**Explicitly Out of Scope (Deferred):**
- Photo intake / computer vision pipelines
- Live Copart / IAAI auction integrations
- Advanced multi-agent decomposition (future)

## Design Principles

- **Everything is observable** — No black boxes.
- **Everything is cacheable** — `ThreadContext` and user plans are aggressively cached in Redis.
- **Everything is retryable** — Inngest provides durability where it matters.
- **Everything is explainable** — Decision Traceability Standard (`decision` / `reason` / `input` / `output`) is enforced everywhere.
- **Everything is swappable** — Abstractions (NotificationService, DevAuthService, RealtimeService) protect us from vendor lock-in.

## Future Evolution

This architecture is designed to scale gracefully:

- New external systems can be added via new Inngest functions.
- New notification channels can be added to the `NotificationService` abstraction.
- New Skills can be added as encapsulated LangGraph graphs.
- Future multi-agent systems can be introduced while keeping the core Request Flow and Control Plane stable.
- We can migrate away from Supabase (or any other tool) with minimal disruption because of our abstraction layers.

## Navigation

All Zoom Level 2 documents are linked above. Start with the ones most relevant to your current work:

- **New to the system?** → Read [request-flow.md](./request-flow.md) and [external-event-controller.md](./external-event-controller.md)
- **Working on notifications?** → Read [notification-strategy.md](./notification-strategy.md) and [failure-mode-and-hitl.md](./failure-mode-and-hitl.md)
- **Setting up locally?** → Read [development-env.md](./development-env.md) and [dev-steps.md](./dev-steps.md)

This architecture gives us a **clear, coherent, and future-proof foundation** while enabling rapid delivery of high-value features in Phase 0.