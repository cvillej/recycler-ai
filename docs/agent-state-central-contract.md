Agent-State-Implementation-Plan.md
Reference: Master-Implementation-Plan.md

Purpose
The Agent State layer provides the single source of truth for all agent/system reasoning, progress, and user session context. It enforces clarity, determinism, and debuggability throughout the agent’s lifecycle by being:

Explicit (no magic LLM-internal state)
Schema-based (Zod + TypeScript)
Extensible (new fields introduced only via well-documented updates)
Fully testable (fixtures for good and bad states required)
Scope
One (and only one) file/module/folder defines the canonical AgentState contract/schema.
All agent logic, prompt routing, tool calls, trace events, and UI flows reference only defined state fields, never hidden/implicit context.
Keys must be versioned and ideally grouped by logical concern (conversation, focus, memory, workflow, error-handling, etc).
Explicit Implementation Requirements
1. Define AgentState Type/Schema
🟦 AGENT:

Use TypeScript interface or type alias for IDE typechecking.
Use Zod (or comparable) runtime schema for validation, parsing, and error messaging.
Enforce consistent field naming (camelCase), no JSON blobs, no “anything goes” fields.
🟨 HUMAN:

The schema must be readable at a glance for new contributors.
Example: Do not lump “working state” in a single string or allow generic key/value maps.
Example
import { z } from "zod";
export const AgentStateSchema = z.object({
  messages: z.array(z.object({
    sender: z.enum(["user", "assistant", "tool"]),
    content: z.string(),
    timestamp: z.string(),
    id: z.string().optional(),
  })),
  threadId: z.string(),
  focus: z.string().nullable(),
  currentPlan: z.string().nullable(),
  memory: z.object({
    workingMemory: z.any().optional(), // Extension point: specialize!
    userProfile: z.any().optional(),
    derivedMemory: z.any().optional(),
  }),
  pivotSignals: z.object({
    pivotDetected: z.boolean(),
    pivotType: z.enum(["hard", "soft", "none"]).optional(),
    focusTopic: z.string().optional(),
  }).optional(),
  pendingToolCalls: z.array(z.string()),
  toolResults: z.array(z.any()),
  requiresApproval: z.boolean(),
  lastError: z.string().nullable(),
  retryCount: z.number().default(0),
  uiArtifacts: z.any().optional(),
  sessionContext: z.record(z.any()).optional(),
  readyToRespond: z.boolean().default(false),
  waitingForUser: z.boolean().default(false)
});
export type AgentState = z.infer<typeof AgentStateSchema>;
2. Field Groups & Minimality
🟦 AGENT:

If a part of state is mapped to prompt contracts, reference the prompt by name and contract version in comments.
Document which workflow/routers require which fields.
🟨 HUMAN:

Less is more: only add fields with a clear rationale and reference to the master doc or main workflow.
3. Test Vectors/Fixtures
🟦 AGENT:

For every change to the schema, create at least:
One complete, valid state object
One invalid/example-bad state object
Automated test should check all invariants (required fields, format compliance, allowed enum values, etc).
🟨 HUMAN:

Review all fixtures as part of code review for schema changes.
Example
// Good example
const goodState = {
  messages: [{ sender: "user", content: "Hi!", timestamp: "2026-04-10T10:00Z" }],
  threadId: "thread-abc-123",
  focus: "order_query",
  currentPlan: "resolve_customer_order",
  memory: {},
  pendingToolCalls: [],
  toolResults: [],
  requiresApproval: false,
  lastError: null,
  retryCount: 0,
  readyToRespond: true,
  waitingForUser: false
};
// Bad example
const badState = {
  // missing required threadId,
  messages: [],
  retryCount: -1, // invalid: must be >=0
  randomField: "should not exist"
};
4. Extension + Versioning Guidance
🟦 AGENT:

Add new fields only with extension justification in the schema comments.
Deprecate fields with clear warning and timeline.
Schema version (if used) should be explicit and updated whenever a breaking change is made.
🟨 HUMAN:

Every new field or change should answer:
“What concrete feature or workflow needs this?”
“How will this be tested, logged, and observed?”
5. Good/Bad Examples (from Master Doc)
Good:
State fields ONLY — never business/significant context in prompt strings.
State fields are required for all major logic (router, prompts, tool calls).
Zod/type schema at runtime and compile-time
All changes reviewed/tested with example fixtures.
Bad:
State is a JSON blob, string, or “catchall” field.
Only the LLM knows what the current state is.
Backend code, prompts, and tools disagree about field meaning/formats.
6. References/Links
Master-Implementation-Plan.md
Other sections:
Prompt-Registry-Contracts-Plan.md
Prompt-Router-Plan.md
