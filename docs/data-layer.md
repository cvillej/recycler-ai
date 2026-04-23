# data-layer.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

This document defines the complete storage architecture for the AI Yard Assistant. It covers both the agent conversation layer and the core salvage yard business domain.

## Purpose of the Data Layer

The Data Layer serves as the single source of truth for:
- All conversation history and runtime state
- The full salvage yard business domain (inventory, auctions, sales, market data)
- User plans, permissions, and usage tracking
- Data required for entity resolution and semantic search

It must support fast reads for the TS Resolver and Context Enricher, efficient writes from the Event Worker, and rich querying for MCP Tools.

## Primary Identifier

All conversations are identified by a single top-level field:

- **`contextId`** (UUID, primary key)

This identifier is used across:
- Conversation messages
- ThreadContext
- Langfuse traces (`session_id = contextId`)
- Future A2A inter-agent communication

**Note**: Existing references to `thread_id` will be migrated to `contextId` as subsystems are built.

## Conversation Storage

Conversation history is stored in a relational table that supports structured messaging.

**Table:** `recycleai.conversation_messages`

```sql
CREATE TABLE recycleai.conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    context_id UUID NOT NULL,
    message_id UUID NOT NULL DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    metadata JSONB,                    -- tool calls, event type, resolved entities, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (context_id) REFERENCES recycleai.thread_context(context_id)
);

CREATE INDEX idx_conversation_messages_context_id ON recycleai.conversation_messages(context_id);
CREATE INDEX idx_conversation_messages_created_at ON recycleai.conversation_messages(created_at);
```

This table stores user messages, assistant responses, and structured system/event messages.

## ThreadContext Table

ThreadContext is the **lightweight runtime snapshot** for a given `contextId`. It contains the most important state the TS Resolver, Context Enricher, and prompt assembly need.

It uses a **dual-storage** strategy:
- **Postgres** as the durable source of truth
- **Redis** as the hot cache for low-latency access

### Postgres Schema

```sql
CREATE TABLE recycleai.thread_context (
    context_id UUID PRIMARY KEY,
    user_id INT NOT NULL REFERENCES recycleai.users(id),
    session_id UUID NOT NULL REFERENCES recycleai.user_sessions(session_id),   -- NEW: mandatory
    
    -- First-class citizens
    focus_state TEXT[] NOT NULL DEFAULT '{}',
    pivot_detected BOOLEAN DEFAULT FALSE,
    memory_summary TEXT,
    
    -- Pricing & control
    user_plan JSONB,
    
    -- Active context pointers
    active_bidding_session_id UUID,
    
    -- Housekeeping
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    raw_context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_thread_context_user_id ON recycleai.thread_context(user_id);
CREATE INDEX idx_thread_context_session_id ON recycleai.thread_context(session_id);
CREATE INDEX idx_thread_context_focus_state ON recycleai.thread_context USING GIN(focus_state);
```

**First-class fields** (explicit columns):
- `focus_state`
- `pivot_detected`
- `memory_summary`
- `user_plan`

**Redis Caching**
- Key pattern: `thread_context:{contextId}`
- Short TTL with explicit invalidation on updates

## Business Domain Schema

The Data Layer includes the full `recycleai` business schema.

**Core Business Tables**

**Taxonomy & Reference Data**
- `makes`, `models`, `part_types`, `condition_grades`
- `ebay_categories`, `ebay_condition_mappings`
- Alias tables: `make_aliases`, `model_aliases`, `part_aliases`

**Core Inventory Entities**
- `vehicles` — Individual vehicles in the yard
- `parts` — Dismantled parts with location, condition, and pricing
- `yard_locations` — Physical yard bin/row/shelf tracking

**Market & Sales Data**
- `ebay_part_market_data` — Historical eBay sold listings and market comps (renamed from `grok_sold_listings`)
- `sales` — Completed yard sales with margin tracking
- `salvage_auctions` — Incoming and tracked auction opportunities

**User & Access Control**
- `users`
- `user_yard_access`

**Key Design Notes**
- Strong foreign key relationships.
- `pg_trgm` extension and trigram indexes for entity resolution.
- Market intelligence (`ebay_part_market_data`) is central for valuation tools.

**Relationship to Conversations**
Conversations link to business entities via foreign keys or metadata in messages / ThreadContext.

## Control & Pricing Tables

**`user_plans`** (Resolved runtime snapshot)
**`permissions_cascade`** (Raw 5-level source of truth)
**`usage_ledger`** (Detailed usage tracking)
**`feature_flags`**

These tables power the Context Enricher and hard enforcement.

## User & Session Management

- `users` and `user_yard_access` (existing)
- Lightweight `user_sessions` table for active UI sessions
- Direct `user_id` link from `thread_context` and messages to `users.id`

## OpenSearch / Vector Indexes

The Data Layer feeds several OpenSearch indexes for semantic search and RAG:

**Semantic (k-NN) Indexes**
- `salvage_agent_responses`
- `salvage_auctions_vectors`
- `salvage_sales_vectors`
- `salvage_market_signals`
- `salvage_resolver`

**Full-Text (BM25) Indexes**
- `salvage_auctions`, `salvage_sales`, `salvage_inventories`, `salvage_search_queries`

Most follow a bootstrap/reindex pattern. `salvage_agent_responses` is append-only at runtime.

## Entity Resolution Support

Entity resolution bridges natural language to canonical records using:
- Lexical matching (exact, alias, `pg_trgm` fuzzy)
- Embedding fallback via `salvage_resolver` index
- Optimized alias tables and trigram indexes

Resolution is an optimization — tools gracefully degrade when it fails.

## Performance, Caching, and Extensibility

**Caching Strategy**
- ThreadContext and User Plans: Aggressively cached in Redis.
- Hot Business Data: Primarily served from Postgres with proper indexing. Redis used sparingly for proven hot paths.
- Semantic search: Handled by OpenSearch.

**Performance Considerations**
- Strategic indexes and `pg_trgm` support.
- Connection pooling and query optimization.

**Extensibility**
- `raw_context` JSONB escape hatch.
- Easy addition of new focus_state values and business tables.
- Bootstrap pattern for OpenSearch indexes.

## Schema Management

- Defined in `db/schema.sql` (single source of truth).
- Applied via `task schema:apply`.
- OpenSearch mappings maintained in JSON files and applied via bootstrap scripts.
