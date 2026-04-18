---
title: Recycle AI Documentation Home
tags: [obsidian, recycle-ai, home]
published: true
aliases: [Overview, MOC]
---

# Welcome to Recycle AI Documentation

This vault contains all necessary documentation for Recycle AI, structured in an interconnected graph format. **Single entry point**: Always start here. Use descriptive [[wikilinks]] to navigate.

## Project Overview
Recycler AI is a modular AI agent system with explicit state management (Zod schemas), hybrid routing, LangGraph orchestration, and extensible prompts. Current skeleton is placeholder; aspirational architecture includes full layers.

## Documentation Structure
### Current Skeleton
1. `apps/web/index.tsx`: Basic UI placeholder.
2. `apps/api/healthz.ts`: Health API.
3. `openrouter-proxy.js`: LLM proxy.

### Aspirational Architecture
```mermaid
mindmap
    root((Recycler AI))
        Architecture
            StateManagement["State Management"]
            PromptSystem["Prompt System"]
            ExecutionEngine["Execution Engine"]
            Router["Hybrid Router"]
        Observability["Observability & Tracing"]
        Extensibility["Extensibility"]
            SchemaEvolution["Schema Evolution"]
            ABTesting["A/B Testing & Canary Routing"]
```

## Main Topic Nodes
- [[UI Layer]]
- [[Prompt System]]
- [[Chat Transport]]
- [[Tool Layer]]
- [[Agent State]]
- [[LangGraph Orchestration]]
- [[Hybrid Prompt Router]]
- [[Observability & Tracing]]
- [[AIProxy-Logging-Tracing]]
- [[DevOps & Deployment]]

## Business & Product
- [[user-stories]] - Ranked user stories, salvage yard research, innovative features, and success metrics
- [[business-model]]
- [[db-proposal]]
- [[db-schema]] - RecycleAI database schema and key relationships

## Usage Guide for Agents
Follow [[wikilinks]] for graph navigation. Links optimized for Obsidian graph view.