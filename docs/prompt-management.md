# prompt-management.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

This document defines how prompts are selected, assembled, and managed in the AI Yard Assistant. The core abstraction is the `prompt_resolution` function.

## Purpose of Prompt Management

Prompt Management ensures the LLM receives the most relevant, precise, and efficient prompt for the current conversation state while respecting user permissions and business constraints.

Key goals:
- Context-aware prompt selection and assembly
- High domain precision for salvage yard operations
- Strong support for feature gating and user plan constraints
- Excellent token efficiency and provider prefix caching
- Full observability and debuggability in Langfuse
- Easy iteration and versioning

All prompt logic is centralized in TypeScript. Langfuse serves as the source of truth for prompt templates and reusable components.

## Core Concept: prompt_resolution

The heart of prompt management is a single function:

```ts
async function prompt_resolution(
  input: PromptResolutionInput
): Promise<PromptResolutionResult>
```

This function takes rich context and produces:
- The final compiled system prompt
- The filtered list of MCP tools
- Metadata for observability and caching

### PromptResolutionInput

```ts
interface PromptResolutionInput {
  // Core identifiers
  contextId: string;
  userId: string;

  // First-class runtime state
  threadContext: ThreadContext;           // focus_state, pivot_detected, memory_summary, user_plan, etc.

  // Conversation history window
  recentMessages: Message[];              // last N full messages for immediate context

  // External and system events
  recentEvents: StructuredEvent[];        // injected events from Event Worker

  // Entity resolution results
  resolvedEntities: ResolvedEntities;     // canonical vehicle/part matches

  // Additional first-class signals
  conversationPhase?: string;             // e.g. "planning", "analysis", "valuation", "decision"
  pinnedFacts?: PinnedFact[];             // critical items that must survive summarization
  activeBusinessContext?: any;            // summarized view of current auction, vehicle, inventory situation, etc.
  toolResultsSummary?: string;            // concise summary of recent tool outcomes
  userPreferences?: UserPreferences;      // long-term user style, priorities, constraints

  // Metadata for smart decisions
  conversationMetadata: {
    turnCount: number;
    estimatedTokens: number;
    lastSummaryTimestamp: Date;
    timeSinceLastSummary: number;         // in minutes
    historyFreshness: number;             // 0-1 score
  };
}
```

### PromptResolutionResult

```ts
interface PromptResolutionResult {
  prompt: string;                         // fully compiled final system prompt
  tools: Tool[];                          // MCP tools filtered by effective_features
  metadata: {
    topLevelPromptName: string;
    componentsUsed: string[];
    variablesInjected: Record<string, any>;
    cacheKey?: string;                    // for prefix caching hints
  };
}
```

`prompt_resolution` is called by the TS Resolver during every request. It is the single place where all signals are combined to decide the prompt and tools.

## Prompt Selection Logic

Inside `prompt_resolution`, selection is **composite** rather than based on `focus_state` alone.

- **Primary signal**: `threadContext.focus_state` — maps directly to a top-level Langfuse prompt.
- **Refinement signals**: `pivot_detected`, `conversationPhase`, `activeBusinessContext`, `resolvedEntities`, `recentEvents`, and `user_plan.effective_features`.
- **Fallback**: Defaults to `chat-default` if no strong match.

The resolver uses a hybrid decision engine (hard rules + weighted scoring) for robust routing.

## Variable Injection Strategy

Once the top-level prompt is selected, variables are injected using Langfuse’s compile mechanism.

Core variables include:
- `memory_summary` and `structured_memory`
- `effective_features_list`
- `token_monthly_remaining`
- `recent_events`
- `resolved_entities`
- `activeBusinessContext`
- `toolResultsSummary`
- `pinnedFacts` and `userPreferences`

Variables are injected in an order optimized for prefix caching (stable prefix first, dynamic context later).

## Tool Selection & Dynamic Guidance

`prompt_resolution` performs intelligent tool management in two stages:

1. **Hard Filtering** by `effective_features` from the resolved `user_plan` (non-negotiable permission boundary).
2. **Context-Aware Limiting and Dynamic Description**:
   - Further limits the tool set based on `focus_state`, `conversationPhase`, and `activeBusinessContext`.
   - The same tool can receive different usage guidance depending on the current prompt context (e.g. auction-specific vs inventory-specific instructions for the same search tool).

Detailed rules for computing and applying `effective_features` are covered in the dedicated `effective_features.md` document.

## Observability & Debugging

Every call to `prompt_resolution` is fully observable in Langfuse:

- `topLevelPromptName` and version
- Components used
- All variables injected
- Final compiled prompt
- Selected tools and their dynamic guidance
- Resolution metadata (which signals influenced the decision)

This makes every prompt self-documenting and reproducible.

## Extensibility & Versioning

- New `focus_state` values can be added by creating new top-level prompts.
- New reusable components can be introduced without changing existing prompts.
- `prompt_resolution` can accept additional signals without breaking the interface.
- Langfuse labels (`production`, `staging`, `experiment-v2`) enable safe versioning and A/B testing.

This design supports both rapid iteration on the single-agent system and the future introduction of specialized SME agents.

