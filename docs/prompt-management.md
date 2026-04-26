# prompt-management.md
**Version:** April 26, 2026  
**Status:** Updated (Zoom Level 2) — Mem0 + 3-Level Focus + Permissions

This document defines how prompts are selected, assembled, and managed in the AI Yard Assistant. The core abstraction is the `prompt_resolution` function.

## Purpose of Prompt Management

Prompt Management ensures the LLM receives the most relevant, precise, and efficient prompt for the current conversation state. It pulls memory primarily from **Mem0** (including 3-level hierarchical focus and workflow-specific state), respects `effective_features` and usage quotas from the Permissions system, and optimizes for token efficiency and Langfuse observability.

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
- The filtered list of MCP tools (including Skills)
- Metadata for observability and caching

### PromptResolutionInput

```ts
interface PromptResolutionInput {
  // Core identifiers
  contextId: string;
  userId: string;

  // First-class runtime state
  threadContext: ThreadContext;

  // Memory (primarily from Mem0)
  memory: {
    summary: string;
    structured: any;                    // workflow-specific + general facts
    focus: {
      overarching: string;
      task_specific: string;
      subtask: string;
    };
  };

  // Permissions & Usage
  effective_features: string[];
  usage_state: {
    plan: string;
    tokens_remaining: number;
    trial_active: boolean;
  };

  // Conversation history window
  recentMessages: Message[];              // last N full messages for immediate context

  // External and system events
  recentEvents: StructuredEvent[];        // injected events from Event Worker / Inngest

  // Entity resolution results
  resolvedEntities: ResolvedEntities;     // canonical vehicle/part matches

  // Additional first-class signals
  conversationPhase?: string;             // e.g. "planning", "analysis", "valuation", "decision"
  pinnedFacts?: PinnedFact[];             // critical items that must survive summarization
  activeBusinessContext?: any;            // summarized view of current auction, vehicle, inventory situation, etc.
  toolResultsSummary?: string;            // concise summary of recent tool outcomes
  userPreferences?: UserPreferences;      // long-term user style, priorities, constraints
  inngestWorkflowState?: any;             // optional: active Inngest workflow / pending HITL state

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
  tools: Tool[];                          // MCP tools + Skills filtered by effective_features
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

- **Primary signal**: `memory.focus` (3-level hierarchical focus) — `overarching_focus` is the strongest signal for top-level prompt selection, with `task_specific_focus` and `subtask_focus` used for refinement.
- **Refinement signals**: `pivot_detected`, `conversationPhase`, `activeBusinessContext`, `resolvedEntities`, `recentEvents`, `user_plan.effective_features`, and `inngestWorkflowState`.
- **Fallback**: Defaults to `chat-default` if no strong match.

The resolver uses a hybrid decision engine (hard rules + weighted scoring) for robust routing.

## Variable Injection Strategy

Once the top-level prompt is selected, variables are injected using Langfuse’s compile mechanism.

Core variables include:
- `memory.summary` (from Mem0)
- `memory.structured` (workflow-specific + general facts)
- `memory.focus` (3-level hierarchical focus)
- `effective_features`
- `usage_state.tokens_remaining`
- `usage_state.plan`
- `recent_events`
- `resolved_entities`
- `activeBusinessContext`
- `toolResultsSummary`
- `pinnedFacts` and `userPreferences`
- `inngestWorkflowState` (when relevant)

Variables are injected in an order optimized for prefix caching (stable prefix first, dynamic context later).

## Tool Selection & Dynamic Guidance

`prompt_resolution` performs intelligent tool management in two stages:

1. **Hard Filtering** by `effective_features` from the resolved `user_plan` (non-negotiable permission boundary).
2. **Context-Aware Limiting and Dynamic Description**:
   - Further limits the tool set based on `focus_state`, `conversationPhase`, and `activeBusinessContext`.
   - The same tool can receive different usage guidance depending on the current prompt context (e.g. auction-specific vs inventory-specific instructions for the same search tool).

Detailed rules for computing and applying `effective_features` are covered in the dedicated `effective_features.md` document.

## Skills Integration (LangGraph)

`prompt_resolution` is also responsible for selecting and presenting **Skills** — deterministic, multi-tool capabilities implemented as LangGraph graphs.

**Key Distinction**:
- The main conversational agent (TS Resolver + `prompt_resolution`) remains custom TypeScript.
- Complex, deterministic tool orchestration is delegated to **LangGraph Skills**.
- `prompt_resolution` can present Skills as high-level tools to the LLM, but the actual execution happens inside the LangGraph graph (and may be orchestrated via Inngest when durability or HITL is required).

When a Skill is selected, `prompt_resolution` injects the Skill’s rich docstring and input schema so the LLM understands when and how to invoke it.

## Observability & Debugging

Every call to `prompt_resolution` is fully observable in Langfuse:

- `topLevelPromptName` and version
- Components used
- All variables injected
- Final compiled prompt
- Selected tools and their dynamic guidance
- Resolution metadata (which signals influenced the decision)
- Skill selection (when applicable)

This makes every prompt self-documenting and reproducible.

## Extensibility & Versioning

- New `focus_state` values can be added by creating new top-level prompts.
- New reusable components can be introduced without changing existing prompts.
- `prompt_resolution` can accept additional signals (e.g. Inngest workflow state, Knock response context) without breaking the interface.
- Langfuse labels (`production`, `staging`, `experiment-v2`) enable safe versioning and A/B testing.

This design supports both rapid iteration on the single-agent system and the future introduction of specialized SME agents.