# development-env.md
**Version:** April 25, 2026  
**Status:** Updated (Zoom Level 2) — Full Langfuse v3 Stack + Inngest + Supabase Realtime + Dozzle

This document defines the local development environment for the `recycler-ai` project. It is optimized for **macOS M4 (Apple Silicon)**, fast iteration with Cursor AI, accurate tracing, trace replay, and dev-mode annotations.

## Purpose

The development environment must enable:
- Extremely fast iteration across web, mobile, and backend
- Excellent visibility into console logs and errors for Cursor AI (while minimizing token usage)
- Accurate local Supabase, Inngest, Supabase Realtime, and full Langfuse v3 tracing with easy pull and replay
- Dev-mode annotations that appear in traces
- A clean, shared todo system that both you and AI coding agents can read and update efficiently

## Recommended Tech Stack

| Category                  | Technology                              | Notes |
|---------------------------|-----------------------------------------|-------|
| **Node Version Manager**  | fnm + Corepack                          | Fast, lightweight, excellent M4 support |
| **Package Manager**       | pnpm (with workspaces)                  | Fastest, lowest disk usage on M4 |
| **Monorepo Tool**         | Turborepo                               | Smart caching for Next.js + Expo |
| **Task Runner**           | Taskfile.yml                            | Human-friendly commands |
| **Web**                   | Next.js 16 (App Router)                 | Main web interface |
| **Mobile + Tablet**       | Expo (React Native) + EAS Build         | iOS + Android + Tablet |
| **Shared UI**             | packages/ui + NativeWind                | Consistent components |
| **Widgets**               | packages/widgets                        | Rich composable widgets |
| **Shared Logic**          | packages/shared                         | Types, API client, realtime |
| **Backend**               | TypeScript (Node.js)                    | Resolver, Event Worker, Inngest functions |
| **Database**              | Supabase Postgres + pgvector            | Primary database + vector search |
| **Realtime**              | Supabase Realtime                       | Low-latency widget updates |
| **Background Jobs**       | Inngest                                 | Durable workflows, HITL, retries |
| **Notifications**         | Knock                                   | Rich notifications + deep links |
| **Observability**         | **Langfuse v3 (Full Stack)**            | ClickHouse + Redis + MinIO |
| **Log Viewer**            | Dozzle                                  | Unified Docker log interface |
| **LLM Gateway**           | LiteLLM (aiproxy)                       | Thin proxy |

## Repository Layout

```bash
recycler-ai/
├── apps/
│   ├── web/                    # Next.js 16 web app
│   └── mobile/                 # Expo React Native app
├── packages/
│   ├── ui/                     # Shared UI components
│   ├── widgets/                # Composable widgets
│   ├── shared/                 # Types, API client, realtime hooks
│   └── config/                 # ESLint, Prettier, TS configs
├── grok-docker/                # Supporting Docker configs (optional reference)
├── infra/
│   └── supabase/               # Supabase schema, migrations, seed data
├── traces/
│   └── replays/                # Saved trace JSON files
├── docs/                       # Full architecture documents
├── todo/                       # Todo system
├── .cursorignore
├── .cursor/
│   └── rules/
├── Taskfile.yml                # Main dev commands (root level)
├── docker-compose.yml          # Full stack (Inngest, LiteLLM, Langfuse v3 full stack, Dozzle)
├── turbo.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .env.example
├── .gitignore
└── README.md
```

## First-Time Setup (Critical)

### 1. Clone and Install Dependencies

```bash
git clone <your-repo>
cd recycler-ai
pnpm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
# Edit .env and fill in all required keys
```

### 3. Start All Supporting Services

```bash
# Start the full Docker stack (Inngest, LiteLLM, Langfuse v3 full stack, Dozzle)
docker compose up -d

# Start Supabase local (separate from Docker)
task dev:supabase
```

### 4. Apply Database Schema

```bash
task db:apply
task db:import-market-data   # Optional: import your existing market data
```

### 5. Verify Everything

```bash
task status
task logs:errors
```

**Access Points:**
- Supabase Studio: http://localhost:54323
- Langfuse: http://localhost:3000
- Inngest: http://localhost:8288
- Dozzle: http://localhost:8081
- Supabase Realtime: ws://localhost:54321/realtime/v1 (via Supabase)

## Supabase Setup (Detailed)

We use the **Supabase CLI** (recommended for best developer experience):

```bash
task dev:supabase          # Runs `supabase start`
```

After first run:
- Copy the local Supabase keys into `.env`
- Run `task db:apply` to apply the full schema
- (Optional) Run `task db:import-market-data` to bring in your existing data

**Schema location:** `infra/supabase/schema.sql`

## Docker Stack (Your Actual Setup)

Your `docker-compose.yml` (in the project root) includes the **full Langfuse v3 stack**:

| Service           | Purpose                              | Required? |
|-------------------|--------------------------------------|---------|
| `inngest`         | Background jobs + HITL               | Yes     |
| `ably-local`      | Realtime development server          | Yes     |
| `dozzle`          | Unified log viewer                   | Yes     |
| `langfuse-web`    | Langfuse UI + API                    | Yes     |
| `langfuse-worker` | Langfuse background processing       | Yes     |
| `clickhouse`      | Langfuse trace storage               | **Yes** |
| `redis`           | Langfuse queue                       | **Yes** |
| `minio`           | Langfuse S3-compatible storage       | **Yes** |

**Important:** Langfuse v3 in your setup **requires** ClickHouse, Redis, and MinIO. They are mandatory in this configuration.

## Daily Development Workflow (Cursor + LLM Optimized)

### Key Taskfile Commands

| Command                        | Description |
|--------------------------------|-----------|
| `task dev:all`                 | Start full stack (Docker + Supabase + Backend) |
| `task dev:backend`             | Start backend only (outside Docker) |
| `task dev:supabase`            | Start/restart Supabase |
| `docker compose up -d`         | Start/restart all Docker services |
| `task logs:errors`             | Show only ERROR/WARN (best for LLM) |
| `task docker:logs:errors`      | Show Docker errors via Dozzle |
| `task trace:pull <traceId>`    | Pull Langfuse trace |

### Logging Strategy for LLM Agent

**Best command:**
```bash
task logs:errors
```

**Even better for complex issues:**
```bash
task docker:logs:errors
```
Then open **Dozzle** at http://localhost:8081 for a beautiful web UI.

## Dev-Mode Annotations

Supported in development mode. Annotations appear in Langfuse traces and are very useful when working with the LLM coding agent.

## Summary

This environment uses your **actual full docker-compose.yml** (with complete Langfuse v3 stack including ClickHouse, Redis, and MinIO) plus Supabase via CLI. It is optimized for Cursor + LLM-assisted development with excellent observability and token-efficient logging.