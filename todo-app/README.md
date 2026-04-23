# Todo App

Isolated, self-contained Todo management application for the recycle-ai project.

## Directory Structure (Strict Compliance)
- `todo-app/todo/`: **Only** actual todo application files (components, hooks, pages, types, App.tsx, main.tsx)
- `todo-app/config/`: **All** build, styling, and TypeScript configuration files
- `todo/`: Root-level data directory containing `todos.yaml` (single source of truth) and `todo-config.json`
- Root `Taskfile.yml`: Only location for dev tasks (`task todo:dev`, etc.)

Everything else the app needs (package.json, node_modules, server, build output) lives inside `todo-app/`.

## Tech Stack
- **Frontend**: Vite + React 19 + TypeScript + TailwindCSS (via CDN for simplicity)
- **Backend**: Hono.js (lightweight, TypeScript-first)
- **Data**: YAML via `js-yaml` with direct filesystem access to `../../todo/todos.yaml`
- **Auto-refresh**: UI polls API every 3 seconds so manual edits to `todos.yaml` on disk are reflected immediately
- **UI Features**: Full CRUD, subtodos, labels, statuses, priority, responsive design

## Development

From root:
```bash
# Start both API server (port 3001) + Vite dev server (port 5174 with HMR)
task todo:dev

# Or run individually
cd todo-app && npm run dev:full
```

The UI will be available at http://localhost:5174

**Note**: AI agents should use the REST API endpoints (`/api/todos*`) rather than editing `todos.yaml` directly, per `docs/development-env.md`.

## API Endpoints (matches development-env.md)
- `GET /api/todos` - List all
- `GET /api/todos/:id` - Get one
- `POST /api/todos` - Create
- `PUT /api/todos/:id` - Update
- `POST /api/todos/:id/subtodos` - Add subtodo
- `DELETE /api/todos/:id` - Delete
- `GET /api/config` - Get labels/status options
- `GET /api/health` - Health check

## Taskfile Integration
See root `Taskfile.yml` for `todo:dev`, `todo:build`, `todo:serve`, `todo:stop` tasks that provide reliable background management with start/stop/restart.

This app is **completely independent** of the main monorepo's Next.js, pnpm workspaces, Turborepo, etc.
