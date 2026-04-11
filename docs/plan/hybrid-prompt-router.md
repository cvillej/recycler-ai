Prompt-Router-Plan.md
Reference: Master-Implementation-Plan.md

Purpose
The Hybrid Prompt Router is the brain of agent control flow. It chooses the next prompt to run by evaluating:

Hard Rules Guard Layer: Deterministic “must-interrupt” and workflow guards (approval, errors, terminal state)
Stateful Workflow Layer: Follows explicit state logic and workflow sequencing
LLM Fallback Layer: Invokes a model for ambiguous or novel situations only, under explicit contract
By structuring routing this way, the system delivers robust, explainable, and safe AI workflows.

Scope
One (and only one) router module encapsulates this decision logic.
The router is called on every agent step/turn.
Every routing event is logged (with reason, input state, and chosen prompt).
Downstream consumers: LangGraph orchestration, tracing/logging, prompt registry, all agent tasks.
Explicit Implementation Requirements
1. Router Signature & Inputs
🟦 AGENT

Export a synchronous selectNextPrompt(state: AgentState): RouteDecision function.
Require as input: current AgentState object.
Return a structured decision object (see below).
Example type signature:
type PromptName = "await_user" | "handle_error" | "detect_pivot" | "classify_intent" |
  "update_focus" | "plan_query" | "execute_tool_reasoning" | "analyze_results" | "respond";
type RouteDecision = {
  nextPrompt: PromptName,
  source: "hard_rule" | "state" | "llm",
  reason: string,
  stateSnippet?: Partial<AgentState>
}
2. Routing Phases & Order
🟦 AGENT

a) Hard Rules Layer
(“Always handle first, never defer to LLM”)

Approval required?
nextPrompt: "await_user", source: "hard_rule", reason: "...", ...
Waiting for user?
Error out of retries?
Terminal condition reached?
b) State-based Workflow Layer
E.g.:
If intent not classified: "classify_intent"
If workflow plan missing: "plan_query"
Tool should run: "execute_tool_reasoning"
Results ready for analysis: "analyze_results"
All work done: "respond"
c) LLM Fallback Layer
(“Only if the above are not decisive.”)

Model is invoked with whitelist of valid prompt choices, clearly logged/structured.
Model output validated against contract before use.
Example router code:
export function selectNextPrompt(state: AgentState): RouteDecision {
  // 1. Hard Rules
  if (state.requiresApproval) return { nextPrompt: "await_user", source: "hard_rule", reason: "Requires approval" };
  if (state.waitingForUser) return { nextPrompt: "await_user", source: "hard_rule", reason: "Waiting for user" };
  if (state.lastError && state.retryCount >= 3) return { nextPrompt: "handle_error", source: "hard_rule", reason: "Error and out of retries" };
  // 2. Workflow State
  if (state.needsIntentClassification) return { nextPrompt: "classify_intent", source: "state", reason: "Need intent classification" };
  if (state.focus === "data_query" && !state.queryPlan) return { nextPrompt: "plan_query", source: "state", reason: "Planning query" };
  // And so on, for other key workflow transitions...
  // 3. LLM fallback
  return callLlmRouterWithWhitelist(state);
}
🟨 HUMAN:

Top-to-bottom: never allow ambiguous guard “holes”
Document, in comments or docs, every hard rule
Changes to router logic must be code-reviewed by an agent-versed dev
3. LLM Router Constraints
🟦 AGENT

LLM called only with whitelist of prompt names (never arbitrary text).
LLM-router should return { nextPrompt, reason } and must be schema-validated.
Do not allow LLM to choose hard-rule or terminal-only prompts.
Log all LLM-routed decisions, model version, and reasoning.
Example bad LLM use (DO NOT DO):
“The LLM can pick any prompt or decide to skip error handling.”
“LLM routed to a prompt that doesn’t exist in the registry.”
🟨 HUMAN:

LLM usage classed as “semantic router” not “power-of-attorney orchestrator”.
Review prompt whitelist and ensure LLM cannot bypass safety rails.
4. Logging & Tracing
🟦 AGENT

Every call to the router logs:
nextPrompt
source ("hard_rule" | "state" | "llm")
reason
the state snippet that led to this decision
previous prompt (if available)
Example logged entry:
{
  "decision": {
    "nextPrompt": "plan_query",
    "source": "state",
    "reason": "Data query focus and no plan exists"
  },
  "focus": "data_query",
  "activeTask": "get user orders"
}
🟨 HUMAN:

Logs are key to safe, debuggable agent workflow.
Any dev should be able to explain “why did the agent do this?” by reading the log/trace.
5. Test Vectors/Fixtures
🟦 AGENT

Router has a suite of test-vectors:
Good: Each scenario in the workflow plan (approvals, planning, tools, etc)
Bad: No applicable prompt, or ambiguous state returns LLM fallback only if allowed
Example:
{
  state: { requiresApproval: true },
  expect: { nextPrompt: "await_user", source: "hard_rule" }
}
6. Good/Bad Practice Callouts
Good: Deterministic, logged, every decision documented; LLM only resolves ambiguity.
Bad: Unlogged prompt selections or loose “whatever the LLM says” routers; LLM can choose error skips.
7. References/Links
Master-Implementation-Plan.md
Agent-State-Implementation-Plan.md
Prompt-Registry-Contracts-Plan.md

