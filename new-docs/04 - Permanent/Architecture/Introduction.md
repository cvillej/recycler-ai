# Architecture Overview

**Purpose**: This document provides a high-level overview of the architecture layers and their interactions within the Recycler AI system, with clear principles guiding the design.

## Target Architecture (TypeScript)

**Core Philosophy**: System is a state machine. Prompts are pure functions. Orchestrator owns truth.

**Layers**:
- State Management (Zod schemas)
- Prompt System + Hybrid Router
- Execution Engine (LangGraph)
- Chat Transport (Next.js + Vercel AI SDK)
- UI (React projection of state)
- Observability (OpenTelemetry + LangSmith)

**Source of Truth**: `[docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)`

**Current Implementation**: Placeholder React app and OpenRouter proxy only. See `apps/web/index.tsx` and `openrouter-proxy.js`.

## Links to Related Concepts
- `[[State Management|Foundation with explicit AgentState schema]]`
- `[[Prompt System|Modular prompting and contracts]]`
- `[[Execution Engine|LangGraph orchestration]]`
- `[[Hybrid Router Extensions|Routing logic and extensions]]`