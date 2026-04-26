# memory-management.md
**Version:** April 26, 2026  
**Status:** Updated (Zoom Level 2) — Mem0 + 3-Level Focus + Langfuse Observability

This document defines the memory management system for the AI Yard Assistant. It covers how the system maintains coherent, relevant, and efficient context using Mem0 as the primary memory engine, with support for 3-level hierarchical focus and workflow-specific state.

## Purpose of Memory Management

Memory Management ensures the agent has coherent, relevant, and efficient context at every point in time while maintaining complete auditability and supporting advanced agent capabilities (including future SME decomposition).

Core responsibilities:
- Persist full raw history indefinitely for audit, debugging, and long-term recall
- Maintain high-quality, compact active memory (`memory_summary` and `structured_memory`) for prompt injection and reasoning
- Support rich metadata, labeling, importance scoring, and provenance for every memory item
- Provide structured memory layers for tools, entity resolution, and future SME agents

Memory includes **both user-driven conversation and external system events** as first-class citizens.

## Core Concepts

### 3-Level Hierarchical Focus
The system maintains three levels of focus for drift detection and context management:
- `overarching_focus` — The big-picture goal (changes rarely)
- `task_specific_focus` — The current major task
- `subtask_focus` — The immediate action or sub-task

Focus changes are tracked and can trigger memory actions.

### memory_summary (Primary Active Memory)
A concise, natural-language summary of older conversation history. It is the primary view injected into prompts and is managed through Mem0.

### structured_memory (Structured & Queryable Memory)
A rich JSONB object managed by Mem0 containing:
- Extractable facts and entities
- User preferences and pinned items
- Workflow-specific state (e.g., `ebay_listing`, `auction_pivot`)
- 3-level focus history

Used by `prompt_resolution`, tools, and Skills.

### Full Raw History
Complete, immutable record of every message and event stored in `conversation_messages` (Supabase Postgres).

### Rich Metadata & Labels (First-Class)
Every memory item carries comprehensive metadata:
- `source`, `source_system`, `event_type`
- `labels` (array): e.g. `["critical", "strategic", "user-preference", "external-event", "auction", "episodic", "semantic"]`
- `importance_score` (0.0–1.0)
- `reason`, `timestamp`, `context_at_creation`, `pinned`

This metadata drives summarization, recall, and pruning decisions.

## Storage Strategy

Memory is managed primarily through **Mem0**, with Supabase providing supporting storage.

### Primary Memory Engine: Mem0
Mem0 is the primary engine for:
- `structured_memory` (including workflow-specific namespaces)
- 3-level hierarchical focus management
- Long-term recall and relevance-based retrieval
- Memory summarization operations

### Supporting Storage: Supabase Postgres + pgvector
- Full raw conversation history (`conversation_messages`)
- `thread_context` hot cache (including `memory_summary`)
- Business domain data (via thin API layer)

**Why pgvector?**
- Excellent developer experience and operational simplicity
- Strong hybrid search for entity resolution
- Atomic transactions with relational data

- **`conversation_messages`** — Full, permanent history of every message and event.
- **`thread_context`** table:
  - `memory_summary` (TEXT)
  - `raw_context.structured_memory` (JSONB)
  - `user_plan`, `focus_state`, `pivot_detected`, etc.

**Why pgvector?**
- Excellent developer experience and operational simplicity (everything in one database)
- Strong hybrid search capabilities when combined with `pg_trgm` and full-text search
- Sufficient performance for Phase 0 data volumes (inventory, market data, conversation memory)
- Atomic transactions with relational data (very powerful for entity resolution)

**OpenSearch** remains available as an optional future layer for very large scale or advanced semantic workloads.

### Hot Cache (Redis)
- `thread_context:{contextId}` — Full current `ThreadContext` (including `memory_summary` and `structured_memory`).
- Short TTL with explicit invalidation by writers.

### Semantic Recall (pgvector Primary)
- Primary vector search uses `pgvector` inside Supabase Postgres.
- Hybrid lexical + semantic search is achieved via `pgvector` + `pg_trgm` + Postgres full-text capabilities.
- OpenSearch can be added later as a secondary store if needed for scale or advanced features.

### Metadata Everywhere
Every memory item (in `structured_memory`, events, and vector documents) carries rich provenance metadata.

## Summarization & Memory Updates

The system uses **early and smart summarization** to keep `memory_summary` relevant and efficient.

### Triggers for Summarization
- Token usage reaches ~60–65% of context window
- Significant change in `overarching_focus` or `task_specific_focus` (pivot detection)
- Workflow state changes (e.g., completion of a major step in eBay listing or auction pivot)
- Explicit request from the agent or user

Summarization is coordinated with Mem0 to maintain coherence between `memory_summary` and `structured_memory`.

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

Compaction runs asynchronously (typically via Inngest) and respects all rich metadata.

## Memory Pruning

Low-importance items may be pruned from active memory based on metadata (importance_score, labels, pinned status, timestamp). Full raw history in `conversation_messages` remains immutable.

## Integration Points

Memory Management (powered by Mem0) integrates with every major layer:

- **Request Flow & TS Resolver**: `prompt_resolution` pulls memory (including 3-level focus and workflow state) from Mem0.
- **Prompt Management**: `memory_summary` and relevant parts of `structured_memory` are injected as variables.
- **Tool Layer & Skills**: Skills can read from and write to Mem0 (especially workflow-specific state).
- **External Event Controller / Inngest**: Events can trigger memory updates via Mem0.
- **Notification Strategy (Knock)**: HITL outcomes and notifications update memory state.
- **Observability (Langfuse)**: All Mem0 operations (reads, writes, summarization, focus changes) are fully traced.

## Extensibility & Future Evolution

Memory Management is designed to scale to multi-agent SME decomposition.

**Extensibility Features**:
- New memory signals can be added to `PromptResolutionInput`.
- New labels and importance rules can be introduced.
- `structured_memory` is fully extensible via JSONB.
- The multi-stage pipelines are modular.

## Summary

Memory Management in the AI Yard Assistant is powered by **Mem0** as the primary engine, combined with Supabase for raw history and hot caching. It treats user messages and external system events as first-class citizens, maintains a 3-level hierarchical focus system, supports workflow-specific memory namespaces, and provides strong observability through Langfuse.

This design supports phone conversations, complex multi-step workflows (such as auction pivot and eBay listing), and long-term scalability while remaining simple and maintainable in Phase 0.