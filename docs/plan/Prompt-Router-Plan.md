# Hybrid Prompt Router

**Reference:** [Master-Implementation-Plan.md](../master-plan.md)

## Purpose

The Hybrid Prompt Router is essential for controlling the flow of interactions within the agent. It intelligently selects which prompt to execute based on a structured priority system, ensuring that actions taken by the agent are logical, explainable, and safely managed.

---

## Scope

- The router logic must handle requests efficiently and deterministically, following a three-layer hierarchical structure:
  1. Hard rules layer
  2. State-based routing layer
  3. LLM fallback layer

- All decisions made by the router must be logged for tracking and debugging, enabling clear historical tracing of actions in LangSmith.

---

## Explicit Implementation Requirements

### 1. Router Function Signature

**🟦 AGENT:**
- Implement a function `selectNextPrompt(state: AgentState): RouteDecision`.
- The function should take an `AgentState` object as input and return a structured routing decision.

#### Example Type Definitions:

```typescript
type PromptName = 
  | "await_user" 
  | "handle_error" 
  | "detect_pivot" 
  | "classify_intent" 
  | "update_focus" 
  | "plan_query" 
  | "execute_tool_reasoning" 
  | "analyze_results" 
  | "respond";

type RouteDecision = {
  nextPrompt: PromptName;
  source: "hard_rule" | "state" | "llm";
  reason: string;
  stateSnippet?: Partial<AgentState>;
};
```

---

### 2. Routing Layer Implementation

**🟦 AGENT:**

#### a) Hard Rules Layer
- Execute first to ensure critical agent paths are respected, such as:
  - Approval requirements
  - Errors and retry limits

#### Example:

```typescript
if (state.requiresApproval) {
  return { nextPrompt: "await_user", source: "hard_rule", reason: "Requires user approval." };
}
```

#### b) State-Based Layer
- Checks the current workflow state and determines next steps based on explicit conditions.

#### Example:

```typescript
if (state.focus === "data_query" && !state.queryPlan) {
  return { nextPrompt: "plan_query", source: "state", reason: "Planning required for data query." };
}
```

#### c) LLM Fallback Layer
- Invoked only when the routing decision is unclear, with the LLM tasked to select prompts based on the current state.

#### Example:

```typescript
return llmSelectNextPrompt(state);
```

---

### 3. Logging and Traceability

**🟦 AGENT:**
- For each routing decision made, log the context, decision, and reason for that choice.

#### Example Log Entry:

```json
{
  "decision": {
    "nextPrompt": "plan_query",
    "source": "state",
    "reason": "Query plan needed."
  }
}
```

---

### 4. Test Vectors

**🟦 AGENT:**
- Each pathway in the router should include test coverage to ensure correct decisions based on various `AgentState` inputs.

Example Tests:

```typescript
const tests = [
  {
    given: { requiresApproval: true },
    expect: { nextPrompt: "await_user", source: "hard_rule" }
  },
  {
    given: { focus: "data_query", queryPlan: null },
    expect: { nextPrompt: "plan_query", source: "state" }
  }
];
```

---

### 5. Good and Bad Practice Callouts

- **Good:**  
  - Each routing decision is made based on deterministic rules, state knowledge, or LLM fallback.  
  - All branches are logged with clear, explainable reasons.  
- **Bad:**  
  - Allowing the LLM to make routing decisions without constraints; vague ‘fallback’ paths with no logging.  

---

### 6. Links/References

- [Master-Implementation-Plan.md](../master-plan.md)
- [Prompt-Registry-Contracts-Plan.md](Prompt-Registry-Contracts-Plan.md)
