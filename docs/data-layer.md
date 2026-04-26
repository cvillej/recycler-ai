# data-layer.md
**Version:** April 26, 2026  
**Status:** Updated (Zoom Level 2) — Hybrid Model: Supabase (Agent Data) + Thin API Layer (Business Data)

This document defines the complete storage architecture for the AI Yard Assistant. It covers both the agent conversation layer and the core salvage yard business domain.

## Purpose of the Data Layer

The Data Layer uses a **hybrid model**:

- **Agent Database (Supabase)**: Conversation history, runtime state (`ThreadContext`, messages, memory), user plans, checkpoints, and agent-specific data.
- **Business Data Access Layer (Thin Internal API)**: Inventory, parts, vehicles, market data, and other core salvage yard domain data (sourced from the existing production Postgres via a controlled abstraction).
- User plans, permissions, notification preferences, and usage tracking remain in the Agent Database.
- Data required for entity resolution, semantic search, and RAG (primarily agent-owned data).

It must support:
- **Fast reads** for the TS Resolver and Context Enricher
- **Efficient writes** from the Event Worker and Post-Response Handler
- **Rich querying** for tools and analytics
- **Vector similarity search** for entity resolution and semantic recall

## Agent Database: Supabase Postgres + pgvector

**Agent Database**: Supabase Postgres (with `pgvector` extension enabled) — used exclusively for agent-owned data.

**Rationale for Supabase (Agent Data)**:
- Excellent local developer experience via Supabase CLI (`supabase start`)
- Native `pgvector` support for entity resolution and semantic search on agent data
- Built-in Row Level Security (RLS) for multi-tenant safety
- Managed scaling, backups, and connection pooling
- Strong balance of velocity and control for Phase 0 and beyond

**Business Data Access Layer**: A thin internal API / webservice that fronts the existing production Postgres database. This abstraction minimizes direct dependency on the legacy system, enables validation/caching at the boundary, and provides a clean migration path for business data in the future.

We continue to use **Redis** aggressively for hot caching of `ThreadContext` and user plans.

## Primary Identifier

All conversations and related data are identified by a single top-level field:

- **`contextId`** (UUID, primary key)

This identifier is used across:
- `conversation_messages`
- `thread_context`
- `memory_summary`, `structured_memory`
- Langfuse traces (`session_id = contextId`)
- Inngest workflow metadata
- Knock and Supabase Realtime events
- Future A2A inter-agent communication

**Migration Note**: Existing references to `thread_id` will be migrated to `contextId` as subsystems are updated.

## Core Tables

### Conversation Layer

**`recycleai.conversation_messages`**
```sql
CREATE TABLE recycleai.conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    context_id UUID NOT NULL REFERENCES recycleai.thread_context(context_id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'chat',
    metadata JSONB DEFAULT '{}',
    importance_score NUMERIC(3,2) DEFAULT 0.5,
    labels TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_messages_context_id ON recycleai.conversation_messages(context_id);
CREATE INDEX idx_conversation_messages_created_at ON recycleai.conversation_messages(created_at);
CREATE INDEX idx_conversation_messages_labels ON recycleai.conversation_messages USING GIN(labels);
```

**`recycleai.thread_context`**
```sql
CREATE TABLE recycleai.thread_context (
    context_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    yard_id UUID NOT NULL,
    focus_state TEXT,
    memory_summary TEXT,
    structured_memory JSONB DEFAULT '{}',
    resolved_entities JSONB DEFAULT '{}',
    pinned_facts JSONB DEFAULT '{}',
    effective_features JSONB DEFAULT '{}',
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_thread_context_user_id ON recycleai.thread_context(user_id);
CREATE INDEX idx_thread_context_yard_id ON recycleai.thread_context(yard_id);
```

### Business Data Access Layer

Business domain data (inventory, vehicles, parts, market comps, etc.) is **not stored directly in Supabase**. It is accessed through a thin internal API layer that fronts the existing production Postgres database.

This design:
- Minimizes direct dependency on the legacy system
- Allows data validation, transformation, and caching at the API boundary
- Provides a clear path for gradual migration of business data into a clean schema later

Key business entities accessed via the API layer (Phase 0 focus):
- Vehicles, parts, inventory
- Market comps and pricing data
- Auction and sales records (deferred integrations)

## Vector Search & Entity Resolution

`pgvector` (in Supabase) is used primarily for:

- Entity resolution and semantic recall on **agent-owned data** (conversations, memory, pinned facts)
- Supporting the TS Resolver and prompt context

Business entity resolution (vehicles, parts, inventory) typically combines:
- API calls to the Business Data Layer
- Cached lightweight records or embeddings in Supabase where performance requires it

**Key Vector Tables** (in Supabase Agent Database):
- `salvage_resolver` (entity resolution embeddings for agent data)
- `salvage_agent_responses` (conversation memory vectors)
- `salvage_market_signals` (market data vectors)

**Hybrid Search Strategy**:
1. Lexical / trigram matching first (fast, exact)
2. Vector similarity fallback (semantic)
3. Reranking with business rules

## Caching Strategy (Redis)

We use **Redis** for hot-path caching:

- `ThreadContext` — aggressively cached (short TTL + invalidation on write)
- `user_plan` and `effective_features` — cached per user
- Hot inventory and market data — cached selectively

**Invalidation Rules**:
- Any write to `thread_context` or `conversation_messages` invalidates the corresponding Redis key
- `user_plan` changes trigger immediate invalidation
- Event Worker is responsible for cache invalidation after external updates

## Performance & Scalability

**Indexing Strategy**:
- B-tree indexes on all foreign keys and high-cardinality columns
- GIN indexes on `labels`, `metadata`, and array columns
- `pg_trgm` indexes for fuzzy text search
- HNSW indexes on all vector columns (for fast approximate nearest neighbor)

**Connection Pooling**:
- Supabase provides built-in pooling
- Application uses Prisma or Drizzle with appropriate pool sizing

**Read/Write Separation** (Future):
- Primary for writes
- Read replicas for analytics and heavy reporting queries (planned)

## Migration from Existing Postgres

**Approach** (executed in Chunk 1):

1. Export current schema + market data from local Homebrew Postgres
2. Create clean `db/schema.sql` with new table definitions
3. Apply new schema to Supabase
4. Write one-time data migration scripts (especially for `market_comps` and inventory)
5. Verify data integrity and vector indexes
6. Switch application connection string to Supabase
7. Decommission or archive old local Postgres

## Security & Multi-Tenancy

- **Row Level Security (RLS)** enabled on all tables containing user or yard data
- `yard_id` is the primary tenant key
- All queries from the application layer include proper `yard_id` filtering
- Sensitive fields (e.g., pricing, internal notes) are protected via RLS policies

## Backup & Retention

- Supabase automated daily backups (retained 7–30 days depending on plan)
- Point-in-time recovery available
- Long-term audit logs (13 months) stored in dedicated audit tables

## Future Evolution

As the system grows, we can:

- Gradually migrate business data from the legacy Postgres into a clean schema (via the thin API layer)
- Add read replicas for analytics workloads
- Introduce sharding by `yard_id` if single-tenant performance becomes a bottleneck
- Move cold data (old conversations, completed auctions) to cheaper storage tiers
- Add a dedicated analytics warehouse (e.g., ClickHouse or BigQuery) for heavy reporting
- Introduce a separate vector database (e.g., Pinecone or Weaviate) if `pgvector` scaling limits are reached

All of these changes can be made with minimal impact on the application layer because of our clean abstraction layers and `contextId`-centric design.

## Summary

The Data Layer uses a **hybrid model**: Supabase Postgres + pgvector for all agent-owned data (conversations, memory, `ThreadContext`, etc.) combined with a thin internal API layer for business domain data. It provides:

- Clean separation between agent data and legacy business data
- Native vector search for agent entity resolution and semantic recall
- Excellent local development experience
- Strong multi-tenant security via RLS (on agent data)
- Clear, low-risk migration path from the existing production database
- Future-proof foundation for scaling

This design supports fast iteration in Phase 0 while providing a solid base for long-term growth and minimal dependency on the legacy system.