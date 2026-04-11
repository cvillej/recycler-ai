# LangGraph Orchestration

**Reference:** [Master-Implementation-Plan.md](../master-plan.md)

## Purpose

The LangGraph Orchestration layer serves as the execution engine that models the agent's decision-making processes through an explicit state machine. It manages prompts, tracks state changes, and ensures seamless execution of workflows, providing a structured approach for processing user interactions and tool executions.

---

## Scope

- Every run must reflect a unique conversational or task-based state while allowing for node transitions, branching logic, and human-in-the-loop interrupt handling.
- The graph representation must support durable state tracking, enabling the system to pause and resume tasks safely.

---

## Explicit Implementation Requirements

### 1. Graph Structure Definition

**🟦 AGENT:**
- Use LangGraph JS to define the structure of the directed graph.
- Each node should represent a prompt/cognitive function, and edges must define valid transitions between nodes.
- The graph should facilitate clear branching logic based on defined routing (hard rules, state, LLM).

#### Example definition:

```typescript
import { Graph } from "langgraph";

const graph = new Graph();

graph.addNode("classify_intent", classifyIntentFunction);
graph.addNode("detect_pivot", detectPivotFunction);
// Add more nodes...

graph.addEdge("classify_intent", "detect_pivot", conditionFunction);
```

---

### 2. Node Execution Logic

**🟦 AGENT:**
- Define a standardized method for executing nodes in the graph that includes:
  - Collecting input from the current state
  - Validating it against the corresponding prompt contract
  - Executing the associated prompt's function
  - Returning the outputs and updating the state accordingly

#### Example node execution:

```typescript
async function executeNode(nodeId: string, state: AgentState): Promise<AgentState> {
    const nodeFunction = graph.getNode(nodeId);
    const input = prepareInputForNode(nodeId, state);
    
    const output = await nodeFunction(input);
    return updateState(state, output);
}
```

---

### 3. State Change Management

**🟦 AGENT:**
- Each edge transition should reflect a possible change in state. Clearly define how transitions impact the `AgentState`:
  - Log the current and previous states
  - Ensure that state changes are traceable
  - Allow for checkpoints that can save the complete AgentState

#### Example state change:

```typescript
function updateState(oldState: AgentState, output: any): AgentState {
    const newState = { ...oldState, ...output };
    logStateChange(oldState, newState);
    return newState;
}
```

---

### 4. Interrupt Handling & User Approval

**🟦 AGENT:**
- Implement nodes that can pause execution and request user input or approval before proceeding.
- Interrupt nodes should be separately identifiable in the graph and handled distinctly from regular workflow nodes.

#### Example:

```typescript
if (requiresApproval) {
    await executeNode("await_user_approval", state);
}
```

---

### 5. Streaming & UI Feedback Integration

**🟦 AGENT:**
- Every node may yield streaming outputs for use in the UI (partial state, intermediate tokens, tool progress, etc).
- Edge transitions can optionally “push” UI signals or status updates as soon as they’re available (for snappy, modern UX).

---

### 6. Tracing & Debuggability

**🟦 AGENT:**
- Every node execution and edge transition must emit traces with relevant information:
  - Node ID
  - Decision made (why this path was taken)
  - Any state transitions resulting from the execution

#### Example trace reference:

```json
{
  "trace": {
    "nodeId": "classify_intent",
    "decision": "Directed to detect_pivot",
    "previousState": { ... },
    "newState": { ... }
  }
}
```

---

### 7. Test Vectors for Graph Operations

**🟦 AGENT:**
- For every edge and node:
  - At least one “happy path” transition test
  - At least one test for ambiguous or error recovery transition
  - At least one test for checkpoint/interruption and resumption

#### Example test scenario:

```typescript
const initialState = { /* initial agent state */ };
const updatedState = await executeNode("classify_intent", initialState);

expect(updatedState).toEqual(expectedStateAfterClassification);
```

---

### 8. Good / Bad Practice Callouts

- **Good:**  
  - Clear delineation between nodes representing prompts and the logic that enables smooth transitions.
  - Interrupts are explicitly handled in the flow and tracked through logging.
- **Bad:**  
  - Unclear or undefined transitions that require implicit assumptions.
  - Missing or incomplete tracing for node executions leading to debugging challenges.

---

### 9. Links/References

- [Master-Implementation-Plan.md](../master-plan.md)
- [Prompt-Module-Plan.md](Prompt-Module-Plan.md)
- [Hybrid-Prompt-Router-Plan.md](Hybrid-Prompt-Router-Plan.md)

---

## ✅ Section 5 Complete: LangGraph Orchestration

