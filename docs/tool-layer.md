# tool-layer.md
**Version:** April 26, 2026  
**Status:** Updated (Zoom Level 2) — LangGraph for Skills only + Post-Purchase Skills

This document defines the Tool Layer — how tools are defined, discovered, selected, and presented to the LLM in the AI Yard Assistant.

## Purpose of the Tool Layer

The Tool Layer provides a safe, standardized, and highly context-aware interface for the agent to interact with data and external systems.

Key goals:
- All tools are exposed via the standardized MCP (Model Context Protocol) gateway in aiproxy
- Tools are dynamically filtered based on user permissions (`effective_features`)
- The same tool can receive **different usage guidance** depending on the current prompt context (`focus_state`, `conversationPhase`, `activeBusinessContext`)
- Strong integration with entity resolution
- Excellent observability and debuggability

## Core Principles

- **MCP First**: Tools are registered and discovered through aiproxy’s MCP Gateway.
- **Hard Filtering**: Only tools allowed by the user’s `effective_features` are ever sent to the LLM.
- **Context-Aware Guidance**: The description and instructions for a tool can change based on the current situation. This is achieved by attaching dynamic guidance in `prompt_resolution`.
- **Entity Resolution Prerequisite**: Tools that operate on vehicles or parts always go through the entity resolver first.

### Example: Context-Aware Tool Guidance

The same underlying MCP tool can be presented very differently:

**Base MCP Tool** (`search_market`):
```json
{
  "name": "search_market",
  "description": "Search for market pricing and sales history.",
  ...
}
```

**In auction_bidding context** (injected guidance):
> "Use search_market to find relevant auction comps. Focus on asking_price, damage_type, projected part-out value, and margin potential. Prioritize upcoming auctions and include lot_number and auction_date."

**In inventory_valuation context** (different guidance):
> "Use search_market to compare against historical sold prices. Calculate margin percentage relative to our listed_price and days_to_sell. Identify fast-movers vs slow-movers."

This dynamic guidance is attached during `prompt_resolution` based on current `focus_state`, `conversationPhase`, and other signals.

## Tool Implementation Language

**Default: TypeScript**

Most tools are implemented in TypeScript for consistency with the rest of the intelligent layer (TS Resolver, Context Enricher, Prompt Management).

**Exceptions: Python**

Python is used for compute-intensive or data-heavy tools (e.g. complex valuation models, image analysis) and for the existing `entity_resolver.py`.

All tools are exposed uniformly via the MCP Gateway in aiproxy.

## Dynamic Tool Selection & Context-Aware Guidance

The Tool Layer performs intelligent tool management in two stages:

1. **Hard Filtering** by `effective_features` from the resolved `user_plan` (non-negotiable permission boundary).
2. **Context-Aware Limiting and Dynamic Description**:
   - Further limits the tool set based on `focus_state`, `conversationPhase`, and `activeBusinessContext`.
   - The same tool can receive different usage guidance depending on the current prompt context.

This ensures the LLM receives a small, highly relevant set of tools with precise instructions for the current situation.

## Entity Resolution Integration

Entity Resolution is a **critical prerequisite** for many tools. It converts natural language into canonical database IDs.

The system makes a very clear distinction:

### Tools That Require Canonical IDs (Strict)

These tools **can only accept resolved canonical IDs**. They will fail gracefully if given raw strings.

**Tool Definition Example** (`value_part`):
```json
{
  "name": "value_part",
  "description": "Calculate current market value and margin for a part. REQUIRES canonical IDs only.",
  "parameters": {
    "type": "object",
    "properties": {
      "vehicle_id": { 
        "type": "integer",
        "description": "Canonical vehicle_id from the vehicles table. Must be resolved via entity resolver first. Do NOT pass natural language."
      },
      "part_type_id": { 
        "type": "integer",
        "description": "Canonical part_type_id from the part_types table. Must be resolved via entity resolver first. Do NOT pass natural language."
      }
    },
    "required": ["vehicle_id", "part_type_id"]
  }
}
```

### Tools That Accept Natural Language (Flexible)

These tools can accept either natural language or canonical IDs (e.g. `search_market`, `search_auctions`).

### Resolution Flow (Enforced)

Before calling any strict tool:
- The system automatically runs `resolve_entities`.
- High-confidence results → tool is called with canonical IDs.
- Ambiguous or low-confidence results → agent is instructed via prompt guidance to call `resolve_entities` explicitly or use `ask_operator` for clarification.

This explicit contract prevents bad data from reaching tools and makes agent behavior predictable.

## Tool Execution Flow

Once a tool is called:

1. Argument validation (especially for canonical ID requirements)
2. Entity resolution (agent data via Supabase; business entities via thin API layer when needed)
3. Tool execution (TypeScript or Python implementation)
4. Structured result formatting
5. Logging and observability

All calls go through aiproxy’s MCP Gateway.

## Observability & Tracing for Tools

Every tool call is fully observable in Langfuse:
- Tool name, arguments, and resolved entities
- Execution time, success/failure status
- Full input/output attached to the trace under the same `contextId`
- Dynamic guidance used for that call is recorded

## Extensibility of the Tool Layer

- New tools can be added by registering a new MCP definition and implementation.
- Context-aware guidance can be extended by creating new Langfuse components.
- Python tools can be added for heavy computation while maintaining a unified MCP interface.
- Future SME agents will be able to discover and call the same tools via MCP/A2A.

This design keeps the Tool Layer both powerful and maintainable as the system evolves.

## Skills: Deterministic Tool Chaining

While individual tools provide atomic capabilities, many real-world operations require **sequencing multiple tool calls with explicit logic** between them. To address this, we introduce **Skills** as a first-class concept in the Tool Layer.

### What Is a Skill?

A **Skill** is a named, versioned, reusable capability that packages:

- One or more tool calls
- Explicit sequencing logic and control flow (branches, loops, error handling)
- Clear input schema, output schema, and applicability conditions
- Deterministic behavior (same inputs → same outputs)
- Optional built-in HITL gates or clarification steps

**Important Distinction**: Skills are implemented as deterministic graphs using **LangGraph**. The main conversational agent (TS Resolver + `prompt_resolution`) remains custom TypeScript code. LangGraph is used **only** for Skills.

Skills sit between **atomic tools** (single API calls) and **full agent workflows**. They provide the **deterministic layer** while still allowing the LLM to decide *when* to invoke them.

### Why Skills Matter

Pure dynamic tool calling (where the LLM freely chooses and sequences any tool at runtime) is powerful but has significant drawbacks in production:

- Unpredictable behavior
- High token cost (re-reasoning the same sequence repeatedly)
- Difficult to audit or govern
- Hard to test and version

**Skills solve these problems** by giving us:

- **Reliability & Auditability** — Execution is deterministic and fully traceable.
- **Cost Efficiency** — No need for the LLM to re-plan common sequences.
- **Governance** — Skills can be enabled/disabled per `effective_features`, versioned, and approved.
- **Safety** — Critical Skills can include mandatory HITL gates (e.g. "ResolvePartAndUpdateLocation" always requires canonical ID confirmation).
- **Reusability** — The same Skill can be used across different focus states and agents.

### How the LLM Interacts with Skills

From the LLM's perspective, a Skill appears as a **single, high-level tool** with a rich docstring that describes its purpose, inputs, outputs, and when it should be used.

Example Skills we will define:

- `ResolvePartAndUpdateLocation` — Resolves ambiguous part name → canonical ID (with HITL gate) → updates inventory location.
- `GenerateFullValuationReport` — Runs market comp search + margin analysis + generates formatted report.
- `ExecuteBiddingSessionWithBudgetCheck` — Monitors active auction, checks budget, places bids within policy, handles outbid scenarios (can involve Inngest + Knock HITL).
- `SmartInventoryIntake` — AI identification + entity resolution + create/update part record (photo intake portion deferred in Phase 0).
- `ManageEbayListingAfterPurchase` — Guides user through part selection, photo upload, pricing, and lists parts on eBay (multi-step HITL workflow).

The LLM still has full agency to decide *which* Skill to invoke and *when*, but once invoked, the Skill executes deterministically.

### Integration with Existing Architecture

- **Tool Layer** — Skills are registered alongside atomic tools and filtered by `effective_features`.
- **effective_features.md** — Individual Skills can be enabled/disabled per user/plan/yard.
- **HITL** — Skills can embed mandatory clarification gates (especially for canonical ID requirements) and can trigger or resume via Knock notifications.
- **Inngest** — Some Skills (especially those involving long-running work or HITL) are orchestrated as Inngest workflows for durability and replayability.
- **Observability** — Every Skill invocation creates a dedicated trace (LangGraph + Inngest) with full input/output and decision reasoning.
- **Memory Management** — Skill results are stored in `structured_memory` with rich metadata.

### Extensibility

Adding a new Skill is straightforward:

1. Define the Skill in the central Skills Registry (name, version, input/output schema, internal tool sequence, applicability conditions).
2. Implement the Skill as a deterministic LangGraph graph (or Inngest workflow when appropriate).
3. Register it in the Tool Layer so it appears in `prompt_resolution` when appropriate.
4. Optionally expose it via MCP for external systems.

No changes to the core resolver or prompt system are required — Skills are discovered and filtered the same way as atomic tools.

### Future Evolution

As we move toward SME agents, Skills will become even more powerful:

- Each SME agent can have its own library of specialized Skills.
- Skills can call other Skills (hierarchical composition).
- Skills can be dynamically composed at runtime based on `focus_state` and available features.

This design gives us the best of both worlds: **agentic flexibility** at the planning level + **production-grade determinism** at the execution level.