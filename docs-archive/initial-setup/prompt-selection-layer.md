
> **a router that chooses the next prompt using a priority order: hard rules first, state-driven routing second, LLM routing last.**

That is the version I would recommend for your app.

## The hybrid model

Think of it as 3 stacked routing layers.

### Layer 1: hard rules

These are deterministic and always win.

Use this for things like:

* approval required
* safety stop
* tool failed
* waiting for user input
* explicit terminal condition
* retry limit reached

This layer should never depend on LLM judgment.

Example:

```ts
if (state.requiresApproval) return "await_user";
if (state.lastError && state.retryCount > 2) return "handle_error";
if (state.waitingForUser) return "await_user";
```

### Layer 2: state-based routing

If no hard rule applies, route based on known workflow state.

Use this for:

* current focus
* active task
* whether a plan already exists
* whether tools have already run
* whether results need analysis
* whether a response is ready

Example:

```ts
if (state.focus === "data_query") {
  if (!state.queryPlan) return "plan_query";
  if (!state.toolResults) return "execute_query_tool";
  return "analyze_query_results";
}
```

### Layer 3: LLM routing

Only use this when the system still does not know what to do next.

Use this for:

* ambiguous user intent
* soft pivots
* unclear next step
* “what kind of task is this?”
* “is this a follow-up or a new direction?”

Example:

```ts
return llmSelectNextPrompt(state);
```

So the hybrid model is not “rules plus LLM mixed randomly.”

It is:

> **rules guard the system, state gives structure, LLM handles ambiguity.**

That is the key idea.

---

## The control flow

With hybrid routing, each turn usually looks like this:

```txt
user message
→ update raw conversation state
→ check hard rules
→ check workflow/state routing
→ if still unclear, call LLM router
→ select prompt
→ execute prompt
→ update state
→ repeat or respond
```

That means the LLM is not your main control plane. It is your **semantic fallback router**.

That keeps the system much more stable.

---

## What the prompt selection layer is responsible for

In a hybrid system, the selection layer should answer:

1. Is there any reason we must stop or branch immediately?
2. Given current workflow state, is the next step already obvious?
3. If not, what prompt should interpret the situation?

That is the whole job.

---

## A practical mental model

A good way to think about it is:

* **hard rules** = operating system
* **state routing** = workflow engine
* **LLM routing** = judgment under uncertainty

That is why hybrid works so well.

---

## What this looks like in code

Here is the shape I would use.

```ts
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
};

function selectNextPrompt(state: AgentState): RouteDecision {
  // 1. Hard rules
  if (state.requiresApproval) {
    return {
      nextPrompt: "await_user",
      source: "hard_rule",
      reason: "Action requires user approval",
    };
  }

  if (state.waitingForUser) {
    return {
      nextPrompt: "await_user",
      source: "hard_rule",
      reason: "System is waiting for user response",
    };
  }

  if (state.lastError && state.retryCount >= 3) {
    return {
      nextPrompt: "handle_error",
      source: "hard_rule",
      reason: "Retry limit reached",
    };
  }

  // 2. State-based routing
  if (state.needsIntentClassification) {
    return {
      nextPrompt: "classify_intent",
      source: "state",
      reason: "Intent has not been classified yet",
    };
  }

  if (state.needsPivotCheck) {
    return {
      nextPrompt: "detect_pivot",
      source: "state",
      reason: "Need to determine whether the user changed direction",
    };
  }

  if (state.focus === "data_query") {
    if (!state.queryPlan) {
      return {
        nextPrompt: "plan_query",
        source: "state",
        reason: "Data query focus but no query plan exists",
      };
    }

    if (!state.toolResults) {
      return {
        nextPrompt: "execute_tool_reasoning",
        source: "state",
        reason: "Query plan exists but tools have not run yet",
      };
    }

    return {
      nextPrompt: "analyze_results",
      source: "state",
      reason: "Tool results available and need analysis",
    };
  }

  if (state.readyToRespond) {
    return {
      nextPrompt: "respond",
      source: "state",
      reason: "All required work is complete",
    };
  }

  // 3. LLM fallback router
  return llmSelectNextPrompt(state);
}
```

This is the core idea of hybrid routing in practice.

---

## What the LLM router should do

In a hybrid setup, the LLM router should be narrow.

It should **not** be asked:

* to run the whole app
* to decide safety boundaries
* to directly call tools arbitrarily
* to mutate all state freely

It should be asked a constrained question like:

```txt
Given the current state, choose the next prompt from this list:

- classify_intent
- detect_pivot
- update_focus
- plan_query
- analyze_results
- respond

Return JSON:
{
  "nextPrompt": "...",
  "reason": "..."
}
```

That is important.

The LLM router is there to resolve ambiguity, not to become the orchestrator.

---

## What kinds of ambiguity should go to the LLM router

Good uses:

* “Is this a new task or continuation?”
* “Does this message change focus?”
* “Is the user asking for analysis, action, or clarification?”
* “Should we ask a follow-up or proceed?”

Bad uses:

* “Should we ignore approval requirements?”
* “Should we bypass retries?”
* “Should we mutate database state now?”
* “Should we treat this tool result as final even though workflow says otherwise?”

Those belong to rules and state logic.

---

## How state fits into hybrid routing

The hybrid pattern only works if state is explicit.

At minimum, your state should include things like:

```ts
type AgentState = {
  messages: ChatMessage[];
  focus: string | null;
  activeTask: string | null;
  needsIntentClassification: boolean;
  needsPivotCheck: boolean;
  queryPlan: QueryPlan | null;
  toolResults: ToolResults | null;
  readyToRespond: boolean;
  waitingForUser: boolean;
  requiresApproval: boolean;
  lastError: string | null;
  retryCount: number;
};
```

Without explicit state, hybrid routing turns into chaos because the router has no stable basis for deciding.

---

## How to think about prompt categories

In hybrid systems, prompts usually fall into 3 kinds.

### 1. interpretation prompts

These help the system understand what is happening.

* `classify_intent`
* `detect_pivot`
* `update_focus`

### 2. workflow prompts

These move a task forward.

* `plan_query`
* `execute_tool_reasoning`
* `analyze_results`

### 3. response prompts

These turn completed work into user-visible output.

* `respond`
* `ask_clarification`
* `handle_error`

The router picks among these based on the layer logic above.

---

## Why hybrid is better than pure LLM routing

Because pure LLM routing tends to drift.

You end up with problems like:

* different choices on similar inputs
* hard-to-debug transitions
* safety/control logic hidden in prompts
* weird loops
* no clean ownership of workflow state

Hybrid avoids that by making the system predictable where it should be predictable, and flexible only where flexibility is actually useful.

---

## How this fits into LangGraph

In LangGraph, hybrid routing usually means:

* normal nodes for prompt execution
* conditional edges for hard-rule and state routing
* one dedicated router node for LLM-based fallback decisions

So conceptually:

```txt
START
→ hard-rule check
→ state router
→ if unresolved, llm router
→ selected prompt node
→ state update
→ next conditional edge
```

You do not need every edge to be LLM-driven.

Most edges should be deterministic.

---

## A good practical pattern

A very solid design is:

### deterministic pre-router

Handles:

* approval
* interrupts
* retries
* obvious workflow branches

### semantic router

Handles:

* intent
* pivot
* ambiguity
* fuzzy task transitions

### deterministic post-router

Handles:

* what to do with the selected prompt result
* whether to continue
* whether to respond
* whether to wait

That pattern is very stable.

---

## What to log

For every prompt selection, store:

* `nextPrompt`
* `source` (`hard_rule`, `state`, `llm`)
* `reason`
* a compact state snapshot
* previous prompt
* resulting state change

Example:

```ts
{
  nextPrompt: "plan_query",
  source: "state",
  reason: "Focus is data_query and no plan exists",
  focus: "data_query",
  activeTask: "find customer records",
}
```

This becomes incredibly helpful in LangSmith, because you can see not just what happened, but why the router thought it was correct.

---

## The most important design rule

In a hybrid architecture:

> **The router chooses the next cognitive function, not the final answer.**

That distinction matters a lot.

The selection layer is not trying to “solve the user’s problem.”
It is trying to answer:

> “What is the best next prompt to run now?”

That is a much smaller and more reliable job.

---

## Recommended philosophy for your app

For your kind of system, I would build the prompt selection layer like this:

* hard deterministic guards first
* explicit state-driven workflow second
* LLM prompt router third
* all decisions logged with reasons
* all prompt outputs constrained by schemas
* orchestrator owns truth, not prompts

