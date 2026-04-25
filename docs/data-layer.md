# data-layer.md
**Version:** April 25, 2026  
**Status:** Updated (Zoom Level 2) — Supabase Primary + Ably Realtime

This document defines the complete storage architecture for the AI Yard Assistant. It covers both the agent conversation layer and the core salvage yard business domain.

## Purpose of the Data Layer

The Data Layer serves as the single source of truth for:
- All conversation history and runtime state
- The full salvage yard business domain (inventory, auctions, sales, market data)
- User plans, permissions, notification preferences, and usage tracking
- Data required for entity resolution and semantic search

It must support fast reads for the TS Resolver and Context Enricher, efficient writes from the Event Worker, and rich querying for MCP Tools.

## Primary Database: Supabase Postgres

**Primary Database**: Supabase Postgres (with `pgvector` enabled)

**Rationale**:
- Excellent developer experience and local development support via Supabase CLI + Docker
- Native `pgvector` support for entity resolution and semantic search
- Strong foundation for Row Level Security
- Good balance of velocity and control for Phase 0

We continue to use **Redis** for hot caching of `ThreadContext`.

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

## Realtime Strategy

**Ably** is used for live updates including:
- `ThreadContext` changes
- Widget reactivity
- Simple in-app notifications
- Job completion signals

Rich, actionable, multi-channel, or HITL notifications are routed through **Knock**.

## Business Domain Schema

The Data Layer includes the full `recycleai` business schema.