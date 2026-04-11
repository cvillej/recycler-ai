Chat-Transport-API-Plan.md
Reference: Master-Implementation-Plan.md

Purpose
The Chat Transport (API) is the single entry and exit point for all real-time user/agent interactions. It mediates:

Receiving user input (messages, metadata)
Forwarding input to the agent graph/orchestration
Streaming back responses (text, tool events, widgets, state changes, interruptions)
Maintaining secure, session-aware, traceable conversations
Scope
Provided as a Next.js API route or equivalent (e.g., /api/chat)
Handles streaming (Server-Sent Events, WebSockets, chunked HTTP, etc.)
All payloads are strictly contract-checked (matching Prompt/AgentState schema)
Auth/session checks included (even if local/dev for now)
All events are properly traced/logged (with trace and correlation IDs for every request/response batch)
Explicit Implementation Requirements
1. API Route Setup
🟦 AGENT:

Implement with Next.js API routes (pages/api/chat.ts or app/api/chat/route.ts).
POST for main chat flow; optionally GET for event stream connection/init.
Accepts: well-formed JSON payload ({ message, threadId, ... }) matching AgentState contracts.
Always validates & parses input (rejection on contract failure).
🟨 HUMAN:

All API parameters must map directly to a supported AgentState or registry-prompt input.
No “loose” API params; everything must be accounted for in schema/type.
2. Streaming Setup & Protocol
🟦 AGENT:

Outbound responses should support chunked streaming (with a clear open/close protocol).
E.g., Server-Sent Events (SSE), HTTP flush, or WebSocket (with proper workflow).
Support partial/incremental outputs for the UI (token stream, events, tool responses, widget intents).
🟨 HUMAN:

API transport protocol choices should balance dev experience (easy local test) and prod scale.
Streaming is preferred, but initial implementation can be polling with design for later upgrade to streaming.
3. Workflow Integration
🟦 AGENT:

Main logic per request/message:
Validate/authenticate user/session (if enabled)
Pull or create thread/session context (for stateless/prod scaling)
Pass payload into agent orchestrator (LangGraph), running one “turn”
Forward agent graph outputs (state, message events, tool/widget emissions) as a unified, contract-bound response or event stream.
Attach relevant trace, span, and correlation IDs to all logs/outputs.
Example (TypeScript):
export default async function handler(req, res) {
  // 1. Auth/session validation (dummy for dev)
  // 2. Parse input, validate against schema
  // 3. Run agent turn (graph.runTurn(inputState))
  // 4. Stream or send output (res.write / SSE)
  // 5. Log trace/correlation info
}
🟨 HUMAN:

Review API docs (OpenAPI, README) to ensure all agents follow agreed payload/response protocols.
4. Error Handling & Interrupts
🟦 AGENT:

All errors must be catchable and traced.
Effective APIs always emit:
Standard error response payload (contract-bound)
Interrupts for approval/wait, with enough state/context for UI to resume
🟨 HUMAN:

Unexpected “lost” errors or cases where UI/agent disagree about session state must be treated as defects.
5. Logging, Trace, and Correlation
🟦 AGENT:

Add tracing headers/IDs to every inbound request and all agent outputs.
Use OTel conventions for all logs where possible.
🟨 HUMAN:

Regularly check that payloads are actually appearing in your tracing stack.
6. Test Vectors
🟦 AGENT:

Tests for:
Standard user message → agent response flow
Streaming multi-step agent output
Error (bad input, lost session, etc) and UI recovery path
Approval interrupts (UI must wait for additional user input)
Test contract: “Can a bot or human client follow the cycle start-to-end without confusion?”
7. Good/Bad Practice Callouts
Good:
All inputs strictly validated; outputs always contract-bound.
Trace/correlation IDs always present in responses/logs.
Interrupts/wait states always explicit; UI can always tell what is expected next.
API spec and test coverage always current.
Bad:
Accepting/returning arbitrary objects or free-form text.
No contract enforcement or schema drift allowed.
Streaming implemented “by guesswork” rather than with a consistent protocol.
8. Links/References
Master-Implementation-Plan.md
Agent-State-Implementation-Plan.md
LangGraph-Orchestration-Plan.md
Prompt-Registry-Contracts-Plan.md
UI-Layer-Plan.md
✅ Section 7 Complete: Chat Transport (API)
