Prompt-Module-Plan.md
Reference: Master-Implementation-Plan.md

Purpose
Prompt modules are the “cognitive functions” of the agent system. Each prompt represents a unique, atomic, and versioned reasoning step—such as intent classification, focus detection, planning, or responding. These are NOT inline strings, but composable, contract-bound modules whose versions and responsibilities are always explicit.

Scope
Each major prompt (“module”) is its own well-defined, versioned file.
Prompt implementation is separated from orchestration/routing logic.
Every prompt:
Has a strict contract (input/output Zod or JSON-schema)
Lives in the registry with version and metadata
Has test vectors/fixtures
Is documented for its intended use, when it must NOT be used, and upgrade/history notes.
Explicit Implementation Requirements
1. Prompt Module File Conventions
🟦 AGENT:

Create a file per prompt module (e.g. classify-intent.prompt.md for LLM text, classify-intent.contract.ts for contracts and logic).
Each module exports:
Prompt text (or function that generates it)
inputSchema and outputSchema
Version string and description
Test vectors (inputs/outputs, see example below)
Optional: a “generator” for multi-stage/component prompts
🟨 HUMAN:

Each prompt must remain narrow in responsibility—do not combine fundamentally different reasoning in one prompt (“plan + respond” is always two modules).
All prompt metadata must be easy for auditing, upgrade, and A/B test tracking.
Example structure
prompts/
  v1/
    classify-intent.prompt.md
    classify-intent.contract.ts
    detect-pivot.prompt.md
    detect-pivot.contract.ts
    ...
2. Core Prompt Set
A minimal set for a robust agent (as supported by the docs, registry, and router):

classify_intent
detect_pivot
update_focus
plan_next_step
execute_tool_reasoning
analyze_results
respond
(handle_error, ask_clarification, ... as needed)
🟦 AGENT:

Use the registry export to define/require these main prompts.
Reference version in every workflow/routing call.
3. Prompt Design & Contracts
🟦 AGENT:

No prompt may accept or return free-form stringified state (“blob struct” pattern forbidden).
Input/Output contracts must always be enforced in runtime agent execution and in all A/B evaluation.
Example contract file
// classify-intent.contract.ts
import { z } from "zod";
export const version = "v1";
export const description = "Classifies user intent by current state/messages.";
export const inputSchema = z.object({
  messages: z.array(z.object({
    sender: z.string(),
    content: z.string()
  })),
  focus: z.string().nullable().optional(),
});
export const outputSchema = z.object({
  intent: z.string(),           // E.g. "order_query", "info_request"
  confidence: z.number(),       // Confidence score 0-1
  nextStep: z.string().optional()
});
🟨 HUMAN:

Make sure prompt contracts are strictly subset/superset of relevant AgentState fields.
Any contract evolution is both code-review and test-case driven.
4. Prompt Text/Template Example
🟦 AGENT:

Store the prompt text clearly, with {{placeholders}} for inputs.
<!-- classify-intent.prompt.md -->
Given the following conversation:
{{#each messages}}
- {{sender}}: {{content}}
{{/each}}
The user's intent is: _______
If the prompt is programmatically assembled, document the process and which portions are static/variable.
🟨 HUMAN:

Keep prompt templates lean, avoid “god prompts”.
5. Test Vectors/Fixtures
🟦 AGENT:

Each file must export at least:
One valid input/output example (usually in .test.ts or attached to contract)
One invalid/misuse example
export const validInput = {
  messages: [{ sender: "user", content: "Can I check my order status?" }]
};
export const validOutput = { intent: "order_query", confidence: 0.96 };
export const invalidOutput = { intent: 5 }; // invalid: wrong type
🟨 HUMAN:

Review/expand test vectors as agent grows; old vectors serve as “regression” guarantees.
6. Good / Bad Practice Callouts
Good:
One prompt per atomic reasoning/function.
Contracts are strictly enforced.
All prompts have version, description, and documented “fit” in workflow.
All test vectors proven via CI and/or registry-level tests.
Bad:
One massive prompt for multiple unrelated tasks.
Prompts with unclear purpose, unused contract fields, or no fixtures.
Outputs are only checked “by eye” or fail “sometimes but not others.”
7. Links/References
Master-Implementation-Plan.md
Agent-State-Implementation-Plan.md
Prompt-Registry-Contracts-Plan.md
Prompt-Router-Plan.md
