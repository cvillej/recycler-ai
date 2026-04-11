LangGraph-Orchestration-Plan.md
Reference: Master-Implementation-Plan.md

Purpose
LangGraph orchestrates the agent as an explicit, traceable state machine, with every workflow branch, prompt invocation, and checkpoint driven by the hybrid router and observed via tracing. The orchestration is responsible for:

Executing one graph “turn” per user or system event
Enforcing deterministic transitions
Supporting persistence (checkpoints), interruptions (user/approval/human-in-the-loop), streaming, and clear failure handling
Integrating all modular prompts, tool calls, and state transitions
Scope
Graph must have:
One entry point, clearly mapped
Nodes for each “atomic cognitive unit” (prompt module)
Conditional edges determined by the prompt router
Dedicated nodes/edges for interrupts/checkpoints (for resumability, approval, etc.)
Fallback node for LLM-ambiguity routing
All graph structure, transitions, and checkpoint events are traceable.
Explicit Implementation Requirements
1. Graph Construction
🟦 AGENT:

Use LangGraph JS library for graph and node creation.
Each prompt module is a node.
Edge transitions are always determined by the hybrid router—never by the LLM output directly.
Cycles/loops are explicit and minimal.
All possible “stuck” or dead-end states must be handled or logged.
Each conditional edge is documented: decision criteria, allowed next nodes, reasons to choose each.
🟨 HUMAN:

The workflow should visually and logically match the team’s agreed “mental workflow”.
Review graph against the master desired workflow before implementation.
Example pseudocode/diagram
graph.addNode("classify_intent", runClassifyIntent);
graph.addNode("detect_pivot", runDetectPivot);
// ...etc for each core prompt
graph.addEdge("classify_intent", "detect_pivot", (state) => router(state).nextPrompt === "detect_pivot");
graph.addEdge("classify_intent", "execute_tool_reasoning", (state) => router(state).nextPrompt === "execute_tool_reasoning");
// Fallback edge for ambiguous cases
graph.addNode("llm_router", runLlmRouter);
graph.addEdge("detect_pivot", "llm_router", (state) => fallbackNeeded(state));
2. Entry, Reentry, and Checkpointing
🟦 AGENT:

START node is always the only entry point (often the router or initial audit node).
Checkpoint node is invoked at workflow-defined save points (after each major step, on approval-required, etc.).
Reentry from checkpoint restores full AgentState.
🟨 HUMAN:

Checkpoints must be planned at logical spots to ensure any “turn” is resumable with no loss of business context.
3. Interrupts, Approval, & Human-in-the-Loop
🟦 AGENT:

Approval-interrupt edge connects router-prompt node to await_user or external handler node.
Agent must idle/wait for explicit user/system event before resuming.
🟨 HUMAN:

Human-in-the-loop must not be an afterthought; plan where operator input can step in (approval gates, fallback on confusion, etc).
4. Streaming & UI Feedback Integration
🟦 AGENT:

Every node may yield streaming outputs for use in the UI (partial state, intermediate tokens, tool progress, etc).
Edge transitions can optionally “push” UI signals or status updates as soon as they’re available (for snappy, modern UX).
5. Tracing & Debuggability
🟦 AGENT:

Each node, edge transition, and checkpoint emits trace spans with:
Current node
Previous node
Reason for transition
Prompt/tool info (if any)
Snapshot of state (minimized for privacy where required; do NOT log sensitive material outside of dev mode)
🟨 HUMAN:

The trace/debug logs should answer: “why did we enter this node; why did we leave this node; what state did we have?”
6. Test Vectors
🟦 AGENT:

For every edge and node:
At least one “happy path” transition test
At least one test for ambiguous or error recovery transition
At least one test for checkpoint/interruption and resumption
Example (conceptual):
Given: intent classified as "order_query", no errors, plan ready
Expect: edge to 'execute_tool_reasoning'
---
Given: approval required, message queue paused
Expect: edge to 'await_user'
7. Good / Bad Practice Callouts
Good:
Graph is deterministic, comprehensible; changes are visible and debuggable
Fallbacks (LLM ambiguity, interrupts) are explicit and logged
All transitions are tested (fixture/trace-backed)
Checkpoints actually restore from all “wait” or error states
Bad:
“Just let the LLM decide next” cycles, or edges not tied to trace logs
No tests for edge conditions (approval/interrupt, recover)
Checkpoints only handled on errors, or not restored fully
8. Links/References
Master-Implementation-Plan.md
Agent-State-Implementation-Plan.md
Prompt-Router-Plan.md
Prompt-Registry-Contracts-Plan.md
Prompt-Module-Plan.md
