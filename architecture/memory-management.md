# memory-management.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

This document defines the complete, production-grade memory management system for the AI Yard Assistant. It covers how the system stores, summarizes, recalls, consolidates, and prunes memory across user interactions and external system events.

## Purpose of Memory Management

Memory Management ensures the agent has coherent, relevant, and efficient context at every point in time while maintaining complete auditability and supporting advanced agent capabilities (including future SME decomposition).

Core responsibilities:
- Persist full raw history indefinitely for audit, debugging, and long-term recall
- Maintain high-quality, compact active memory (`memory_summary` and `structured_memory`) for prompt injection and reasoning
- Support rich metadata, labeling, importance scoring, and provenance for every memory item
- Execute intelligent, multi-stage summarization and consolidation
- Support checkpointing, branching, and time-travel debugging
- Enable forgetting/decay mechanisms that respect importance and relevance
- Provide structured memory layers for tools, entity resolution, and future SME agents

Memory includes **both user-driven conversation and external system events** as first-class citizens.

## Core Concepts

### memory_summary (Primary Active Memory)
A concise, natural-language summary of older conversation history. It lives in the `thread_context` table and is the primary view injected into prompts.

### structured_memory (Structured & Queryable Memory)
A rich JSONB object (`raw_context.structured_memory`) containing extractable facts, resolved entities, user preferences, open questions, external events, and pinned items. Used by tools, resolvers, and future agents.

### Full Raw History
Complete, immutable record of every message and event stored in `conversation_messages` (Postgres).

### Checkpoints
Full, restorable snapshots of the agent’s state at meaningful points (pivots, major decisions, tool calls, user approvals). Enables time-travel, branching, and debugging.

### Rich Metadata & Labels (First-Class)
Every memory item carries comprehensive metadata:
- `source`, `source_system`, `event_type`
- `labels` (array): e.g. `["critical", "strategic", "user-preference", "external-event", "auction", "episodic", "semantic"]`
- `importance_score` (0.0–1.0)
- `reason`, `timestamp`, `context_at_creation`, `pinned`

This metadata drives summarization, recall, pruning, and checkpoint decisions.

## Storage Strategy

Memory is stored in multiple places with clear responsibilities and different access patterns.

### Primary Storage (Postgres)
- **`conversation_messages`** — Full, permanent history of every message and event.
- **`thread_context`** table:
  - `memory_summary` (TEXT)
  - `raw_context.structured_memory` (JSONB)
  - `user_plan`, `focus_state`, `pivot_detected`, etc.
- **`checkpoints`** table — Restorable snapshots.

### Hot Cache (Redis)
- `thread_context:{contextId}` — Full current `ThreadContext` (including `memory_summary` and `structured_memory`).
- Short TTL with explicit invalidation by writers.

### Semantic Recall (OpenSearch)
- Vector indexes (`salvage_agent_responses`, `salvage_sales_vectors`, `salvage_auctions_vectors`, etc.) for semantic search and RAG-style recall.

### Metadata Everywhere
Every memory item (in `structured_memory`, events, and vector documents) carries rich provenance metadata.

## Summarization Pipeline & Triggers

The system uses an **intelligent, multi-stage summarization pipeline** to keep `memory_summary` concise and useful.

### Primary Trigger (Token-based)
After each assistant response, if the estimated token count of the conversation history exceeds 65% of the target model’s context window, an **asynchronous summarization job** is queued.

### Secondary Triggers
- Major change in `focus_state` or `pivot_detected`
- Agent explicitly requests a summary or more memory
- User explicitly requests a summary or says "remember this"
- High-importance external events (based on `importance_score` and `labels`)
- Long period of inactivity (periodic cleanup)
- Model-detected low coherence (optional future self-check)

### Multi-Stage Summarization Pipeline (Background)
1. **Extraction** — Identify key facts, decisions, preferences, open questions, and important external events using rich metadata.
2. **Compression** — Summarize non-critical parts into concise bullets.
3. **Merge** — Combine new summary with existing `memory_summary` and `structured_memory`.
4. **Validation** (optional) — Quick coherence check.

The pipeline produces updated `memory_summary` and `structured_memory`. The new state is written back to `thread_context` and Redis cache is invalidated.

## Pivot Handling

A **pivot** is a major shift in conversation focus. The system treats pivots as high-signal events.

### Pivot Pipeline
1. **Immediate Summarization Trigger** — Summarize the current topic immediately.
2. **Memory Boundary / Checkpoint Creation** — Store pre-pivot context as a distinct chunk labeled `pre-pivot`.
3. **Refresh / Re-prioritization of Memory** — Refresh `memory_summary` to emphasize the new focus.
4. **Importance Re-scoring** — Lower importance of old-topic memories; boost new-topic memories.
5. **User / Agent Notification** — Agent acknowledges the pivot to the user.

## Compaction

Compaction (also called memory consolidation or "dreaming") reorganizes, deduplicates, extracts structured facts, and compresses memory into a more efficient form.

### Purpose
- Prevent gradual drift and noise
- Reduce redundancy
- Extract structured knowledge
- Maintain long-term coherence

### Proposed Compaction Pipeline (Background)
1. **Scan & Extraction**
2. **Deduplication & Consolidation**
3. **Fact Extraction & Labeling**
4. **Reorganization & Compression**
5. **Validation & Persistence**

Compaction runs asynchronously and respects all rich metadata.

## Forgetting and Decay Mechanisms

Forgetting and decay affect only active memory (`memory_summary` and `structured_memory`). Full raw history remains immutable.

### Decay Strategy
Every memory item carries rich metadata that drives decay decisions:
- `importance_score`, `labels`, `pinned`, `timestamp`

**Decay Rules**:
- `pinned = true` or `critical` → Never decayed.
- `strategic` or `user-preference` → Decay extremely slowly.
- High `importance_score` → Decay slowly.
- `transient` or low `importance_score` → Decay faster.

### Pruning & Archiving
Low-importance items are compressed or removed from active memory. Very old, low-relevance items may be archived to OpenSearch vector indexes.

## Integration Points

Memory Management integrates with every major layer:
- **Data Layer**: Primary storage (`thread_context`, `conversation_messages`, `checkpoints`).
- **External Event Controller**: Event Worker injects structured events with rich metadata.
- **Request Flow & TS Resolver**: `prompt_resolution` receives memory signals; post-response handler triggers summarization, compaction, and checkpointing.
- **Prompt Management**: `memory_summary` and `structured_memory` are injected as variables.
- **Tool Layer**: Tools read from `structured_memory`; tool results are added with rich metadata.
- **Observability**: All memory operations are fully traced in Langfuse.

## Extensibility & Future Evolution

Memory Management is designed to scale to multi-agent SME decomposition.

**Extensibility Features**:
- New memory signals can be added to `PromptResolutionInput`.
- New labels and importance rules can be introduced.
- `structured_memory` is fully extensible via JSONB.
- The multi-stage pipelines are modular.

**Future Evolution**:
- Cross-conversation / User-level memory
- Memory consolidation / "Dreaming" jobs
- Explicit memory layering (episodic, semantic, procedural, strategic)
- Advanced forgetting / decay using semantic similarity and user-defined policies
- Memory sharing across SME agents

## Summary

Memory Management in the AI Yard Assistant is a complete, production-grade system that treats user messages and external system events as first-class citizens, maintains rich metadata and labels, uses intelligent multi-stage summarization and compaction, supports checkpointing, and provides forgetting/decay mechanisms. It is deeply integrated with every layer and designed for long-term scalability and robustness.