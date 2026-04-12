Tool-Layer-Plan.md
Reference: Master-Implementation-Plan.md

Purpose
The Tool Layer is responsible for providing the agent with safe, type-checked, auditable, and traceable abilities to interact with external systems—such as APIs, databases, or integrations. Tools are never “just a function call” or an LLM instruction; they are atomic, contract-governed, and centrally registered.

Scope
Every tool is its own file or object, with:
Zod/JSON-schema input and output contract
Version and description
Audit and logging hooks
Sample test vectors
All tool calls pass through the same tracing and error handling infrastructure.
Tools are immutable: they may only report outputs, not directly mutate AgentState; all outputs must be consumed via explicit state update logic in the graph.
Explicit Implementation Requirements
1. Tool Definition & Contract
🟦 AGENT:

Each tool is a module with:
inputSchema and outputSchema
Tool function (async, returns output matching schema)
version, description
Optional: tool “category,” allowed agents/states, execution budget
Example
import { z } from "zod";
export const version = "v1";
export const description = "Query the orders database for a user's order status.";
export const inputSchema = z.object({
  userId: z.string(),
  orderId: z.string(),
});
export const outputSchema = z.object({
  status: z.enum(["pending", "shipped", "delivered", "cancelled"]),
  eta: z.string().optional(),
  error: z.string().optional(),
});
export async function queryOrderStatusTool(input: z.infer<typeof inputSchema>) {
  // ...implementation, API/database query
  return { status: "shipped", eta: "2026-04-11" };
}
🟨 HUMAN:

Never allow tools to “leak” arbitrary internal state.
Each contract must be referenced and reviewed for every tool; never allow free-form results.
2. Tool Registry
🟦 AGENT:

Create a registry file (e.g., tools/index.ts) that:
Aggregates all available tool modules by name and version
Exposes lookup/access with type assertion
Optionally, restricts which agent workflows can invoke which tools
Example:
import * as QueryOrderStatus from './queryOrderStatus.tool';
export const toolRegistry = {
  "queryOrderStatus@v1": QueryOrderStatus,
  // Add more tools here
};
3. Input/Output Validation
🟦 AGENT:

All tool input and output is validated before/after execution using contract schemas.
“Fail closed”: reject tool calls with invalid inputs/outputs and always log errors for tracing.
Example
function safeInvokeTool(tool, input) {
  const parsedInput = tool.inputSchema.parse(input);
  const output = await tool.toolFunction(parsedInput);
  tool.outputSchema.parse(output); // Throws/test fails if invalid
  return output;
}
4. Test Vectors & Auditing
🟦 AGENT:

Each tool must export:
At least one valid input and output example
One “bad case” misuse input
Add/maintain unit tests for tools in CI.
🟨 HUMAN:

Tool test coverage is as important as prompt/graph coverage (see: security/adversarial concerns).
5. Logging, Trace ID, and Error Handling
🟦 AGENT:

All tool use, results, and errors are logged with trace/correlation id, input, output, and error detail.
Logs must never leak sensitive parameters except where necessary for dev (with clear redaction policy, as described in /tracing-approach.md).
🟨 HUMAN:

Periodically review all logs for completeness, privacy, and error/edge-case coverage.
6. Good / Bad Practice Callouts
Good:
Every tool is type-checked, traced, versioned, with clear contracts and audit hooks.
No direct AgentState mutation; only controlled by graph transitions after output.
Test coverage for edge cases, audit logs for security-sensitive tools.
Bad:
“Black box” tools invoked with generic objects/text.
LLM allowed to call arbitrary code outside the registry.
Tools with unclear, unstable, or hidden outputs.
7. Links/References
Master-Implementation-Plan.md
Agent-State-Implementation-Plan.md
Prompt-Registry-Contracts-Plan.md
Prompt-Router-Plan.md
LangGraph-Orchestration-Plan.md
