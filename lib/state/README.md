# State Management Module

This module defines the `AgentState` schema—the **single source of truth** for the Recycler AI system.

## Overview

- **Schema**: Zod-based `AgentStateSchema` (v1.0) with nested `MessageSchema` and `RouterStateSchema`.
- **Types**: Full TypeScript inference (`AgentState`, `Message`, `RouterState`).
- **Migration**: Versioned schema evolution with `parseWithMigration()`.
- **LangGraph Integration**: Checkpoint creation/loading utilities.
- **Validation**: Parse helpers with invariants (e.g., chronological messages).

## Usage

### Basic Validation
```typescript
import { parseAgentState, createInitialState } from '@state/schema';

const state = createInitialState();
const validated = parseAgentState(state);
```

### LangGraph Checkpoints
```typescript
import { createCheckpoint, loadCheckpoint } from '@state/schema';

// Save
const checkpoint = createCheckpoint(state);
await storage.write(checkpoint);

// Load (with migration)
const restored = loadCheckpoint(await storage.read());
```

### Schema Evolution
```typescript
import { parseWithMigration } from '@state/schema';

// Handles v1.0, missing version, future migrations
const state = parseWithMigration(rawJSON);
```

## Architecture Links

Start at the documentation entry point:
- `obsidian-docs/Home.md`

Related docs:
- `obsidian-docs/Agent-State.md`
- `new-docs/04 - Permanent/Extensibility/State Schema Evolution.md`
- `new-docs/04 - Permanent/Architecture/Prompt System.md` (consumes `AgentState` via contracts)
- `new-docs/04 - Permanent/Router/Overview.md` (Hybrid Router consumes this schema)
- `new-docs/04 - Permanent/Architecture/Execution Engine.md` (uses state reducers)
- `new-docs/04 - Permanent/Extensibility/Hybrid Router Extensions.md`

## Design Principles

1. **State‑first**: All layers (Hybrid Router, Execution Engine, UI) depend on this schema.
2. **Explicit over implicit**: Zod schemas enforce type safety at runtime.
3. **Versioned evolution**: Backward‑compatible migrations for LangGraph checkpoints.
4. **Observable**: State fields are designed for tracing (OpenTelemetry/LangSmith).

## Testing

Run `npm test` for unit tests covering validation, migrations, and checkpoint roundtrips.