# dev-steps.md
**Version:** April 25, 2026  
**Status:** Draft

This document defines the recommended development strategy and step-by-step plan for building the AI Yard Assistant.

## Development Philosophy

**Core Principles:**
- Build the "Nervous System" first (Request Flow + Tools + Memory + Observability)
- Stay **API-first** for the first 3–4 weeks (no UI until the core loop is stable)
- Optimize for **Cursor + LLM coding agent** workflow
- Make logging and debugging extremely efficient (the LLM will analyze logs and propose fixes)
- Use Docker for supporting services, but run the backend outside Docker for easy debugging

**Key Tools:**
- **Taskfile.yml** — Single source of truth for all commands
- **docker-compose.yml** — All supporting services (Inngest, Ably, Langfuse, Dozzle, Redis, MinIO, ClickHouse)
- **Supabase CLI** — Best-in-class local Postgres + pgvector experience
- **Dozzle** — Unified Docker log viewer (http://localhost:8081)
- **Cursor + LLM Agent** — Primary development interface

---

## Recommended Local Development Architecture

| Component              | Runs Where          | Reason |
|------------------------|---------------------|--------|
| **Backend (Node.js)**  | Outside Docker      | Easy Cursor debugging + LLM can read source + logs directly |
| **Supabase**           | `supabase start`    | Best local developer experience |
| **Inngest**            | Docker              | Has excellent local UI |
| **Ably Local**         | Docker              | Simple |
| **Langfuse v3**        | Docker (with ClickHouse + MinIO) | Full observability |
| **Dozzle**             | Docker              | Unified log viewer for all services |
| **Redis / ClickHouse** | Docker              | Supporting services only |

---

## Chunked Development Plan

### Chunk 1: Foundation (3–5 days)

**Goal:** Get a clean, working foundation with Supabase, basic request flow, and observability.

**Tasks:**
1. Set up monorepo (pnpm + Turborepo + Taskfile)
2. Create `grok-docker/docker-compose.yml` (Inngest, Ably, Langfuse, Dozzle, Redis, MinIO, ClickHouse)
3. Set up Supabase local via CLI + migrate existing market data
4. Create basic `Request Flow` skeleton
5. Integrate Langfuse from day 1
6. Create `task dev:all` and `task logs:errors` commands
7. Set up Dozzle (http://localhost:8081) as primary log viewer

**Success Criteria:**
- `task dev:all` starts everything cleanly
- Can make a basic API call that hits the resolver and returns a response
- Langfuse traces are working
- Dozzle is accessible and showing logs from all services
- LLM agent can run `task logs:errors` and analyze output

---

### Chunk 2: Core Agent Loop (5–7 days)

**Goal:** Build a functional agent that can reason, use tools, and maintain memory.

**Tasks:**
1. Implement full `prompt_resolution` + dynamic tool guidance
2. Build Tool Layer + Entity Resolution (start with 4–5 core tools)
3. Implement basic Memory Management (`memory_summary` + summarization)
4. Add `effective_features` enforcement
5. Full end-to-end API testing (no UI yet)
6. Set up Cursor debugging launch configurations

**Success Criteria:**
- Can run a full conversation turn via API
- Tools execute correctly with entity resolution
- Memory summarization works
- LLM agent can debug issues using `task logs:errors` + Langfuse traces + Dozzle

---

### Chunk 3: Reliability + Background (5–7 days)

**Goal:** Make the system production-ready with proper background processing and observability.

**Tasks:**
1. Full Memory Management (compaction, checkpoints, decay)
2. Inngest integration + Event Worker
3. Quota enforcement + proper error handling
4. Comprehensive Langfuse tracing (Decision Traceability Standard)
5. Basic Inngest + HITL workflow examples

**Success Criteria:**
- Long-running jobs work reliably via Inngest
- Full observability across Request Flow, Memory, Tools, and Inngest
- LLM agent can trace issues end-to-end using Langfuse + Dozzle + logs

---

### Chunk 4: Notifications + HITL (5–7 days)

**Goal:** Add rich notifications and closed-loop Human-in-the-Loop flows.

**Tasks:**
1. Implement `NotificationService` abstraction
2. Integrate Knock (rich notifications + deep links)
3. Integrate Ably (realtime widget updates)
4. Build Mandatory Clarification Gate + basic HITL flows
5. User preference engine integration

**Success Criteria:**
- Rich notifications work via Knock
- Simple realtime updates work via Ably
- HITL flows (especially clarification gates) function correctly
- LLM agent can debug notification issues using logs + Ably/Knock dashboards

---

### Chunk 5: UI Layer (7–10 days)

**Goal:** Build the frontend experience.

**Tasks:**
1. Set up Next.js 16 web app
2. Build basic chat interface
3. Implement Widget system foundation
4. Connect to Ably for realtime updates
5. Add dev-mode annotations
6. Polish and performance tuning

**Success Criteria:**
- Working chat interface with realtime updates
- Widgets update correctly via Ably
- Full end-to-end flow from user message → agent response → UI update

---

## Docker + Taskfile Setup (Critical for LLM Workflow)

### Recommended Taskfile Commands

```yaml
# Start everything
dev:all:
  desc: Start full development environment
  cmds:
    - task docker:up
    - supabase start
    - task dev:backend

# Start only backend (outside Docker - best for debugging)
dev:backend:
  desc: Start Node.js backend (outside Docker)
  cmds:
    - pnpm --filter backend dev

# Show only errors (perfect for LLM agent)
logs:errors:
  desc: Show only ERROR and WARN logs across all services
  cmds:
    - docker compose -f grok-docker/docker-compose.yml logs --tail=100 -f | grep -E "(ERROR|WARN)"

logs:backend:
  desc: Show backend logs
  cmds:
    - pnpm --filter backend dev 2>&1 | grep -E "(ERROR|WARN|info)"

# Docker-specific commands
docker:up:
  desc: Start all Docker services (Inngest, Ably, Langfuse, Dozzle, etc.)
  cmds:
    - docker compose -f grok-docker/docker-compose.yml up -d

docker:logs:errors:
  desc: Show only errors from Docker services (via Dozzle)
  cmds:
    - echo "Open Dozzle at http://localhost:8081 for best experience"
    - docker compose -f grok-docker/docker-compose.yml logs --tail=200 -f | grep -E "(ERROR|WARN)"
```

### Logging Strategy for LLM Agent

**Primary Tools (in order of preference):**

1. **Dozzle** (http://localhost:8081) — Best unified view of all Docker logs
2. `task docker:logs:errors` — Quick terminal view of errors
3. `task logs:errors` — Combined view including backend
4. Langfuse (http://localhost:3000) — Application-level tracing

**Best Practice for LLM Agent:**
> "When debugging, first check Dozzle at http://localhost:8081. If you see errors, summarize them and propose fixes."

---

## Debugging with Cursor + LLM

**Recommended Setup:**

1. **Run backend outside Docker** (`task dev:backend`)
2. Use **VS Code / Cursor launch.json** for Node.js debugging
3. LLM agent can:
   - Read source code
   - Check Dozzle at http://localhost:8081
   - Run `task logs:errors`
   - Analyze Langfuse traces
   - Propose fixes directly in code

**Cursor Rules Recommendation:**
Create `.cursor/rules/dev-logging.mdc` with instructions like:
> "When debugging, always start by checking Dozzle at http://localhost:8081 or running `task logs:errors`. Analyze only the relevant errors. Propose minimal, targeted fixes. Prefer fixing root cause over symptoms."

---

## Migration of Existing Postgres Data

**Timing:** During **Chunk 1 (Foundation)**

**Steps:**
1. Export current schema + market data from local Postgres
2. Create clean `db/schema.sql` with new tables (`thread_context`, `conversation_messages`, `user_plans`, etc.)
3. Use Supabase CLI or `psql` to apply new schema
4. Write one-time import script for existing market data
5. Verify data integrity
6. Decommission old local Postgres (or keep for reference)

---

## Final Notes

- Stay **API-first** until Chunk 4 is complete
- Prioritize **observability and logging** from day 1 — this will save massive time when the LLM is helping debug
- Keep the backend running **outside Docker** for maximum debuggability with Cursor
- Use **Dozzle** (http://localhost:8081) as the primary log viewer for all Docker services
- Use `task logs:errors` as the primary command for the LLM agent when terminal access is needed

This plan is designed to be incremental, testable, and optimized for an LLM-assisted development workflow with excellent visibility across all services.