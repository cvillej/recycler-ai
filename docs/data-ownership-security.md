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

Memory Management is a cross-cutting concern that interacts with every major layer of the architecture.

### With Data Layer
- `thread_context` table is the primary storage for `memory_summary`, `structured_memory`, checkpoints, and all first-class memory fields.
- `conversation_messages` holds the full immutable raw history.
- `checkpoints` table stores restorable snapshots.
- OpenSearch vector indexes are populated from memory data for semantic recall and long-term archiving.

### With External Event Controller
- The Event Worker injects external events as structured messages with rich metadata (`source`, `labels`, `importance_score`, `reason`).
- Context Enricher updates `user_plan` and can trigger memory refreshes or summarization on plan changes.
- Event Worker and Context Enricher are responsible for invalidating Redis cache when they modify memory.

### With Request Flow & TS Resolver
- `prompt_resolution` receives `memory_summary`, `structured_memory`, `recentEvents`, `resolvedEntities`, `pinnedFacts`, and other memory signals as first-class inputs.
- Post-response handler triggers summarization, compaction, checkpoint creation, and cache invalidation after each LLM turn.

### With Prompt Management
- `memory_summary` and `structured_memory` are injected as variables into prompts.
- Dynamic tool guidance can reference memory state (e.g. "based on our previous discussion about...").
- Summarization, compaction, and pivot handling are triggered from the request flow.

### With Tool Layer
- Tools can read from `structured_memory` for precise facts and resolved entities.
- Tool results are added to memory with rich metadata (`source: "tool_result"`, `labels`, `importance_score`, `reason`, `context_at_call`).
- Entity resolution results are stored in `structured_memory` for future use.

### With Observability (Langfuse)
- All memory operations (summarization, compaction, checkpoint creation, decay, pivot handling) are logged as traceable events under the same `contextId`.
- Rich metadata makes it possible to audit why a particular memory item was kept, summarized, compacted, or pruned.

This tight integration ensures memory is actively maintained and used intelligently across the entire system.

## Extensibility & Future Evolution

Memory Management is designed to scale gracefully from the current single-agent system to a full multi-agent SME architecture.

### Extensibility Features

- New memory signals can be added to `PromptResolutionInput` without breaking existing logic.
- New labels and importance scoring rules can be introduced via configuration or new components.
- `structured_memory` is fully extensible via JSONB.
- The multi-stage summarization, compaction, and pivot pipelines are modular and can be extended with new stages.
- Checkpointing supports branching and time-travel, laying the foundation for complex workflows.

### Future Evolution (Beyond v1)

The following advanced capabilities are part of the full vision:

- **Cross-conversation / User-level memory** — Persistent memory shared across multiple `contextId`s for the same user (long-term preferences, learned habits).
- **Memory consolidation / "Dreaming" jobs** — Periodic background jobs that reorganize, distill, and consolidate memory (similar to Claude Code’s Auto Dream).
- **Explicit memory layering** — Separate handling for episodic, semantic, procedural, and strategic memory types.
- **Advanced forgetting / decay** — Sophisticated relevance-based pruning using semantic similarity and user-defined policies.
- **Memory sharing across SME agents** — Future specialized agents can read from and contribute to shared user-level and conversation-level memory.

These extensions will be implemented as the system evolves toward more autonomous and multi-agent behavior.

## Summary

Memory Management in the AI Yard Assistant is a complete, production-grade system that:

- Treats both user messages and external system events as first-class citizens
- Maintains rich metadata, labels, importance scoring, and provenance for every memory item
- Uses token-based primary triggers with intelligent secondary triggers
- Employs multi-stage summarization, compaction, and pivot handling pipelines
- Supports checkpointing for debugging, HITL, and branching
- Provides hybrid storage (Postgres + Redis + OpenSearch) for different access patterns
- Ensures extensibility for long-term growth and future SME decomposition

This design gives the agent coherent, efficient, and highly contextual memory while maintaining full auditability and robustness.