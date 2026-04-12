# Chat Transport (API)

**Reference:** [Master-Implementation-Plan.md](../master-plan.md)

## Purpose

The Chat Transport (API) is the single entry and exit point for all real-time user/agent interactions. It mediates:

- Receiving user input (messages, metadata)
- Forwarding input to the agent graph/orchestration
- Streaming back responses (text, tool events, widgets, state changes, interruptions)
- Maintaining secure, session-aware, traceable conversations

---

## Scope

- Provided as a Next.js API route or equivalent (e.g., `/api/chat`)
- Handles streaming (Server-Sent Events, WebSockets, chunked HTTP, etc.)
- All payloads are strictly contract-checked (matching Prompt/AgentState schema)
- Auth/session checks included (even if local/dev for now)
- All events are properly traced/logged (with trace and correlation IDs for every request/response batch)

---

## Explicit Implementation Requirements

### 1. API Route Setup

**🟦 AGENT:**
- Implement with Next.js API routes (`pages/api/chat.ts` or `app/api/chat/route.ts`).
- POST for main chat flow; GET for event stream connection/init.
- Accepts: well-formed JSON payload (`{ message, threadId, ... }`) matching AgentState contracts.
- Always validates & parses input (rejection on contract failure).

#### Example (TypeScript):

```typescript
export default async function handler(req, res) {
  // 1. Auth/session validation (dummy for dev)
  // 2. Parse input, validate against schema
  // 3. Run agent turn (graph.runTurn(inputState))
  // 4. Stream or send output (res.write / SSE)
  // 5. Log trace/correlation info
}
```

**🟨 HUMAN:**
- All API parameters must map directly to a supported AgentState or registry-prompt input.
- No “loose” API params; everything must be accounted for in schema/type.

---

### 2. Streaming Setup & Protocol

**🟦 AGENT:**
- Outbound responses should support chunked streaming (with a clear open/close protocol).
  - E.g., Server-Sent Events (SSE), HTTP flush, or WebSocket (with proper workflow).
- Support partial/incremental outputs for the UI (token stream, events, tool responses, etc).

**🟨 HUMAN:**
- Streaming optimization should not sacrifice clarity—users must be able to follow along.

---

### 3. Workflow Integration

**🟦 AGENT:**
- Main logic per request/message:
  1. Validate/authenticate user/session (if enabled)
  2. Pull or create thread/session context (for stateless/prod scaling)
  3. Pass payload into agent orchestrator (LangGraph), running one “turn”
  4. Forward agent graph outputs (state, message events, tool/widget emissions) as a unified, contract-bound response or event stream.
  5. Attach relevant trace, span, and correlation IDs to all logs/outputs.

#### Example (TypeScript):

```typescript
export default async function handler(req, res) {
  // Validate user/session
  // Parse message and validate
  const result = await agent.runTurn(req.body);
  res.json(result);
}
```

**🟨 HUMAN:**
- Regularly engage with the API to ensure all calls align with the expected User-Agent interaction model.

---

### 4. Error Handling & Interrupts

**🟦 AGENT:**
- All errors must be catchable and traced.
- Effective APIs always emit a standard error response payload (contract-bound); interrupts should allow re-engagement with the flow.

#### Example Error Response:

```json
{
  "error": "Invalid input.",
  "code": 400,
  "message": "Missing required field: threadId"
}
```

**🟨 HUMAN:**
- Any unresolved API issues should trigger reviews to ensure a smooth development and operational experience.

---

### 5. Logging, Trace, and Correlation

**🟦 AGENT:**
- Add tracing headers/IDs to every inbound request and all agent outputs.
- Use OTel conventions for all logs where possible.

**🟨 HUMAN:**
- Regularly check that payloads are actually appearing in your tracing stack.

---

### 6. Test Vectors

**🟦 AGENT:**
- Tests for:
  - Standard user message → agent response flow.
  - Streaming multi-step agent output.
  - Error and UI recovery path.

#### Example Tests:

```typescript
const messageTests = [
  {
    message: { content: "Check my order status", threadId: "order-thread-1" },
    expect: { status: 200, body: { ... } }
  },
  {
    message: { content: "", threadId: "" },
    expect: { status: 400, error: "Invalid input." }
  }
];
```

---

### 7. Good / Bad Practice Callouts

- **Good:**
  - All inputs strictly validated; outputs always contract-bound.
  - Trace/correlation IDs always present in responses/logs.
  - Interrupts/wait states are evident and manageable for the user.
- **Bad:**
  - Accepting/returning arbitrary objects or free-form text.
  - No contract enforcement or schema drift allowed.

---

### 8. Links/References

- [Master-Implementation-Plan.md](../master-plan.md)
- [Agent-State-Implementation-Plan.md](Agent-State-Implementation-Plan.md)
- [LangGraph-Orchestration-Plan.md](LangGraph-Orchestration-Plan.md)
- [Tool-Layer-Plan.md](Tool-Layer-Plan.md)

---

## ✅ Section 7 Complete: Chat Transport (API)
