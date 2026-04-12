---

title: Hybrid Prompt Router Documentation
tags: [obsidian, recycle-ai, hybrid-router]
published: true
---

# Hybrid Prompt Router Overview

The Hybrid Prompt Router is the critical component responsible for controlling the flow of interactions within the agent. It intelligently selects which prompt to execute based on a structured hierarchy of routing rules.

## Purpose
This router ensures that the decisions made by the agent are logical, explainable, and safely managed through:
- Hard rules enforcement for critical workflow interrupts.
- Stateful workflow logic that aligns with the agent's current state.
- An LLM fallback for ambiguous situations.

## Explicit Implementation Requirements
### 1. Router Signature & Inputs
- Export a function:
```typescript
selectNextPrompt(state: AgentState): RouteDecision;
```
- This function MUST take the current `AgentState` as input and return a structured decision object.

### Example Decision Structure
```typescript
type RouteDecision = {
  nextPrompt: PromptName;
  source: "hard_rule" | "state" | "llm";
  reason: string;
  stateSnippet?: Partial<AgentState>;
};
```

### 2. Routing Phases
- **Hard Rules Layer**: Always execute first for must-interrupt scenarios (e.g., user approval).
- **State-Based Workflow Layer**: Evaluate conditions based on the current state and determine next prompts accordingly.
- **LLM Fallback Layer**: Only invoked when hard rules and state logic provide no clear outcome.

### 3. Logging & Traceability
- Every routing decision MUST log the input state, chosen prompt, and reasoning behind that choice for transparent debugging purposes.

### Example Logging
```json
{
  "decision": {
    "nextPrompt": "plan_query",
    "source": "state",
    "reason": "Data query focus and no plan exists"
  }
}
```

## Related Topics
- For insights on how prompts are constructed, see [[Prompt System]].
- For understanding how to manage events and states, refer to [[LangGraph Orchestration]].

---
