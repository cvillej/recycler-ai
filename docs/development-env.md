# development-env.md
**Version:** April 25, 2026  
**Status:** Updated (Zoom Level 2) — Supabase + Inngest + Knock + Ably + Dozzle

This document defines the local development environment for the `recycler-ai` project. It is optimized for **macOS M4 (Apple Silicon)**, fast iteration with Cursor AI, accurate tracing, trace replay, and dev-mode annotations.

## Purpose

The development environment must enable:
- Extremely fast iteration across web, mobile, and backend
- Excellent visibility into console logs and errors for Cursor AI (while minimizing token usage)
- Accurate local Supabase, Inngest, Ably, Langfuse, and Dozzle tracing with easy pull and replay
- Dev-mode annotations that appear in traces
- A clean, shared todo system that both you and AI coding agents can read and update efficiently

## Recommended Tech Stack
Use fnm (fast Node manager) + Corepack + pnpm

| Category                  | Technology                              | Notes |
|---------------------------|-----------------------------------------|-------|
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
| **Realtime**              | Ably (not Supabase Realtime)            | Low-latency widget updates |
| **Background Jobs**       | Inngest                                 | Durable workflows, HITL, retries |
| **Notifications**         | Knock                                   | Rich notifications + deep links |
| **Observability**         | Langfuse v3 (with ClickHouse + MinIO)   | Full tracing + analytics |
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
├── infra/
│   └── docker-compose.yml      # Inngest, Ably, Langfuse, Dozzle, Redis, MinIO, ClickHouse
├── traces/
│   └── replays/                # Saved trace JSON files
├── docs/                       # Full architecture documents (human reference)
├── todo/                       # Todo system
│   ├── todo-config.json
│   └── todos.yaml              # Single source of truth (YAML)
├── .cursorignore               # Critical for token efficiency
├── .cursor/
│   └── rules/                  # Cursor AI persistent rules
├── Taskfile.yml                # Main dev commands
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── .env.example
├── .gitignore
└── README.md
```

## Development Workflow Tailored for Cursor AI on macOS M4

### Daily Taskfile Commands

| Command                        | Description |
|--------------------------------|-----------|
| `task dev:all`                 | Start full stack: web + mobile + backend + Supabase + Docker services |
| `task dev:web`                 | Start only web |
| `task dev:mobile`              | Start only mobile |
| `task dev:backend`             | Start backend (outside Docker - best for debugging) |
| `task dev:supabase`            | Start Supabase local (Postgres + pgvector) |
| `task dev:docker`              | Start all Docker services (Inngest, Ably, Langfuse, Dozzle, etc.) |
| `task dev:ably`                | Start Ably Local |
| `task dev:langfuse`            | Start Langfuse stack |
| `task build`                   | Build everything |
| `task restart`                 | Quick full restart |
| `task trace:pull <traceId>`    | Pull trace and save as JSON |
| `task trace:replay <traceId>`  | Replay saved trace locally |
| `task infra:up`                | Start Docker services |
| `task logs:errors`             | Show only ERROR/WARN lines (token-efficient for LLM) |
| `task docker:logs:errors`      | Show only errors from Docker services (via Dozzle) |

### Unified Log Viewer: Dozzle (Recommended)

We use **Dozzle** as the primary log viewer for all Docker services. It provides:

- A clean web UI at **http://localhost:8081**
- Real-time log streaming from multiple services
- Search and filtering across containers
- Easy access to error logs

**Access Dozzle:**
```bash
task docker:up          # Make sure services are running
open http://localhost:8081
```

**Why Dozzle?**
- Much better than terminal `docker logs` for monitoring many services
- The LLM agent can be instructed to check Dozzle when debugging
- Supports desktop notifications on errors (optional setting)

### Cursor AI Logging Strategy (Token-Efficient)

To give the Cursor AI coding agent reliable access to logs and errors **without wasting tokens**:

1. Split the terminal into 3–4 panes in Cursor.
2. Run the services in separate panes.
3. When asking Cursor AI, prefer:  
   `"Run 'task logs:errors' and tell me if there are any problems."`

   Or even better:
   `"Check Dozzle at http://localhost:8081 and summarize any errors."`

Cursor AI can see the live terminal output across all panes without you having to copy-paste large logs every time.

### Dev-Mode Annotations (UI Feature)

In development mode only (`NODE_ENV === 'development'`), the UI provides a built-in ability to add annotations directly to the chat interface.

- Each message shows a small **"Annotate"** icon.
- You can add free-text notes or tags (e.g. "This response hallucinated the part ID").
- Annotations are sent as metadata and attached to the Langfuse trace.
- When you pull a trace (`task trace:pull <traceId>`), the JSON includes the `annotations` array.
- Annotations are **never stored or sent** in production.

### Todo System (Shared Human + AI Task Tracking)

To keep track of work efficiently for both you and AI coding agents, we use a lightweight **Todo API** with **YAML as the single source of truth**.

#### Design Goals
- Human-readable and easy to edit
- AI coding agents (Cursor, etc.) can **read** the YAML file but **must** call the Todo API to make any changes
- Structured enough for the Todo Web UI to render and edit cleanly
- Minimal token usage

#### Config File (`todo/todo-config.json`)

```json
{
  "todoDir": "./todo",
  "activeTodoFile": "todos.yaml",
  "allowedLabels": [
    "ui",
    "backend",
    "tracing",
    "devtools",
    "mobile",
    "performance",
    "high-priority",
    "blocked"
  ],
  "statusOptions": ["unstarted", "in_progress", "blocked", "done"]
}
```

#### Todos YAML Format (`todo/todos.yaml`)

```yaml
lastUpdated: "2026-04-22T10:15:00Z"

todos:
  - id: "todo-001"
    title: "Implement Dev-Mode Annotations in UI"
    status: "in_progress"
    priority: "high"
    labels: ["ui", "devtools"]
    description: "Add UI ability to annotate messages in dev mode so they appear in Langfuse traces when pulled."
    subtodos:
      - id: "todo-001-1"
        title: "Design UI pattern (annotate icon next to messages)"
        status: "done"
      - id: "todo-001-2"
        title: "Implement frontend component in packages/widgets"
        status: "in_progress"
      - id: "todo-001-3"
        title: "Update request-flow to accept and forward annotations"
        status: "unstarted"

  - id: "todo-002"
    title: "Add Cursor Rules for Token Efficiency"
    status: "unstarted"
    priority: "medium"
    labels: ["devtools"]
    description: "Create .cursor/rules/ files to reduce token usage."
    subtodos: []
```

#### Todo API

A lightweight local web server (`task todo:serve`) provides REST endpoints and opens a simple web UI for viewing and editing the YAML file.

**Key Rules for AI Agents:**
- Cursor and other AI coding agents **must not** edit `todo/todos.yaml` directly.
- They **must** call the Todo API endpoints to create, update, or change status of todos.
- They are allowed to read `todo/todos.yaml` directly for context.

**Main Endpoints:**
- `GET /todos` — List all todos
- `GET /todos/:id` — Get single todo with sub-todos
- `POST /todos` — Create new todo
- `PUT /todos/:id` — Update todo (status, description, labels)
- `POST /todos/:id/subtodos` — Add sub-todo

The web UI (opened automatically by `task todo:serve`) allows easy checkbox toggling, label selection, and description editing with a "Save" button.

### Cursor Rules Strategy (Token Efficiency)

Cursor AI performs best when it has **persistent, low-token knowledge** of the project.

Create focused rule files in `.cursor/rules/` that summarize the architecture and workflows. Each rule file should end with: “If you need more detail, refer to the full document at `docs/xxx.md`”.

This strategy keeps token usage low while giving the agent the essential knowledge automatically.

## Local Services

All supporting services run via `grok-docker/docker-compose.yml` and local tooling:

- **Supabase** (Postgres + pgvector) — via Supabase CLI (`supabase start`)
- **Inngest** — via Docker (port 8288)
- **Ably Local** — via Docker (port 8080)
- **Langfuse v3** (with ClickHouse + MinIO) — via Docker (port 3000)
- **Dozzle** — Unified log viewer (port 8081)
- **Redis** — via Docker (port 6379)
- **MinIO** — via Docker (ports 9090/9091)

Use `task docker:up` to start all Docker services and `task dev:supabase` for Supabase.