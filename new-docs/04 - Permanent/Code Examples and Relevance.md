---
template: Recycler Note Template
type: guidance
tags: [recycle-ai, code-examples]
created: {{date:YYYY-MM-DD}}
updated: {{date:YYYY-MM-DD}}
status: stable
---

# Code Examples and Relevance

**Purpose**  
Explains which code examples to follow in the documentation and why they are relevant to our current and target implementation.

**Key Concepts**

**Target Architecture (TypeScript)**
The primary examples in the docs represent our aspirational stack. We have confirmed TypeScript as the right choice for:
- `AgentState` schema (Zod)
- `HybridRouter` class with hard rules, state-based routing, and LLM fallback
- Migration functions
- LangGraph node/edge definitions

These examples are drawn from `[docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)` and `[docs/extensibility.md](docs/extensibility.md)`.

**Current Implementation (Skeleton)**
- `apps/web/index.tsx` — Placeholder React chat UI
- `apps/api/healthz.ts` — Basic API handler
- `openrouter-proxy.js` — OpenRouter proxy with context-compression plugin

**Source of Truth**
- Architecture: `[docs/architecture/system-architecture.md](docs/architecture/system-architecture.md)`
- Extensibility: `[docs/extensibility.md](docs/extensibility.md)`

**Links to Related Concepts**
- `[[State Management|AgentState type example]]`
- `[[Hybrid Router Extensions|RouteDecision and HybridRouter class]]`
- `[[State Schema Evolution|Migration function example]]` 

**Backlinks**