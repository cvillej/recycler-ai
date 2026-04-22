# request-flow.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

This document describes the end-to-end request flow for the AI Yard Assistant — the main pipeline that processes user messages and proactive turns from the UI all the way to the LLM response.

## Purpose of the Request Flow

The Request Flow is the **orchestration backbone** of the system. It is responsible for:

- Receiving user input from the UI
- Enriching context and enforcing hard controls early
- Assembling the prompt and selecting tools
- Routing the request through the thin aiproxy (LiteLLM) to the LLM
- Handling the response and updating state
- Ensuring token efficiency, observability, and consistent behavior

It maintains a clean separation:
- Intelligence & decision-making lives in TypeScript
- LLM gateway and infrastructure lives in aiproxy

## High-Level Request Flow

### User-Driven Turn

1. **Chat Transport (TS API Route)**
   - Receives the incoming user message via streaming endpoint
   - Authenticates the user and extracts `contextId` and `user_id`

2. **Context Enricher** (External Event Controller)
   - Loads and resolves the 5-level permission cascade
   - Builds the enriched `ThreadContext` (focus_state, memory_summary, user_plan, etc.)
   - Performs initial hard enforcement (feature allowed? quota check?)

3. **TS Resolver**
   - Receives the enriched `ThreadContext`
   - Maps `focus_state` to the appropriate Langfuse top-level prompt
   - Selects and filters MCP tools based on `effective_features`
   - Fetches and assembles the final prompt by injecting variables
   - Constructs the clean OpenAI-compatible request payload

4. **aiproxy (Thin LiteLLM Proxy)**
   - Receives the fully assembled request
   - Performs routing, model fallback, and prefix caching where possible
   - Applies final hard budgeting and account enforcement using LiteLLM native features
   - Forwards the request to the target LLM

5. **Post-Response Handling**
   - Streams the response back to the UI
   - Updates `ThreadContext`
   - Invalidates Redis caches
   - Logs the full turn for Langfuse observability

Proactive turns (initiated by the Event Worker) follow the exact same pipeline after the initial event message is injected.

## Detailed Request Flow

### 1. Chat Transport (Entry Point)
- Next.js API route receives the user message and streaming request.
- Authenticates via Cognito and resolves `contextId` and `user_id`.
- Passes the request to the Context Enricher.

### 2. Context Enricher
- Runs early in every request.
- Resolves the 5-level permission cascade and builds enriched `ThreadContext`.
- Performs initial hard checks.

### 3. TS Resolver
- Determines the top-level Langfuse prompt based on `focus_state`.
- Selects filtered MCP tools.
- Assembles the final prompt with variable injection.
- Builds the complete request payload.

### 4. aiproxy (Thin LiteLLM Proxy)
- Handles routing, prefix caching, and final hard budgeting.
- Acts as the MCP Gateway for tools.
- Forwards to the LLM provider.

### 5. Post-Response Handling
- Streams output to UI.
- Updates `ThreadContext` and invalidates caches.
- Records usage and logs to Langfuse.

## Identity, Virtual Keys, and Per-ContextId Budgeting

- The UI (browser session) authenticates the user and provides `user_id` and `session_id`.
- One browser session can have many `contextId` (chat sessions).
- Context Enricher resolves the user plan and prepares budget context.
- TS layer selects or creates a LiteLLM **virtual key** scoped to the current `contextId`.
- This virtual key carries `max_budget_per_session` as a guard rail against runaway loops.
- aiproxy enforces the budget using LiteLLM native features.
- Actual usage is synced back to `usage_ledger`.

This provides two layers of protection: application-level checks + infrastructure-level hard enforcement.

## Prompt Assembly Strategy (in TS Resolver)

Prompt assembly happens in TypeScript for better control and debuggability.

The resolver:
- Selects the top-level Langfuse prompt based on `focus_state`
- Composes reusable components
- Injects variables (`memory_summary`, recent events, `effective_features`, budget info, etc.)
- Filters tools by `effective_features`
- Builds the OpenAI-compatible payload with stable prefix first (for optimal caching)

## Token Efficiency & History Management

The Request Flow uses a hybrid history management approach:

- Full history is persisted in `conversation_messages`.
- Only a smart subset is sent to the LLM: `memory_summary` + most recent messages.

**Summarization Process**
- **Primary trigger**: After each assistant response, if history tokens > 65% of the model’s context window, queue an asynchronous summarization job.
- **Multi-stage pipeline**: Extraction → Compression → Merge → Validation.
- Updated `memory_summary` is written back to `ThreadContext` for future turns.

This keeps prompts efficient while preserving context.

## Non-Functional Properties of the Request Flow

- **Performance**: Low latency for enrichment and resolver (< 150ms target).
- **Token Efficiency**: Hybrid history + minimal tools + prefix caching.
- **Cost Control**: Dual-layer enforcement (application + LiteLLM virtual keys).
- **Reliability**: Consistent path for user-driven and proactive turns.
- **Observability**: Full Langfuse traces under `contextId`.
- **Maintainability**: Clear separation — TS owns intelligence, aiproxy owns delivery.

