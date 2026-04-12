Prompt-Registry-Contracts-Plan.md
Reference: Master-Implementation-Plan.md

Purpose
The Prompt Registry & Contracts layer is the backbone of modular AI programming in Recycle-AI. Every prompt is treated as a “first-class module:” versioned, schema-checked, addressable, and testable. This registry is necessary for:

composable, upgradable AI workflows
robust prompt A/B testing & safe rollback
LangSmith/OTel tracing/debugging
agent-wide determinism
Scope
Prompts are not inline strings or scattered code—they live in a registry.
Each prompt:
Is represented as a file/module (.md, .ts, etc.)
Declares a version/id, description, and both input and output contract (Zod/JSON-schema).
Has test vectors and usage notes.
The registry itself is a code module (not just a folder) that supports lookup, versioning, and access control.
Explicit Implementation Requirements
1. Registry Structure
🟦 AGENT:

Implement a core registry export (e.g. prompts/index.ts) that aggregates and exposes all available prompts by id/version.
Each prompt module must export:
promptText (if text, in markdown or string for LLM use)
inputSchema (Zod, JSON-schema or similar)
outputSchema
version (semver or human-readable string)
description
(Optionally) test vectors/fixtures
🟨 HUMAN:

Registry file/folder structure must be easy to navigate, add new prompts, or audit at a glance.
Example structure
prompts/
  v1/
    classify-intent.prompt.md
    classify-intent.contract.ts
    detect-pivot.prompt.md
    detect-pivot.contract.ts
    ...
index.ts   // aggregates, documents, and exports the registry
Example registry code (TypeScript)
import * as ClassifyIntent from "./v1/classify-intent.contract";
import * as DetectPivot from "./v1/detect-pivot.contract";
// ...add all core prompts
export const promptRegistry = {
  "classify_intent@v1": ClassifyIntent,
  "detect_pivot@v1": DetectPivot,
  // ...
};
export type PromptId = keyof typeof promptRegistry;
2. Prompt Contract Requirements
🟦 AGENT:

inputSchema: Must validate all LLM/tool input, checked before invocation.
outputSchema: Must validate LLM/tool output, checked after invocation.
Both schemas should use Zod, JSON-schema, or equivalent.
Prompt module may export example test vectors.
Example contract (detect-pivot.contract.ts)
import { z } from "zod";
export const version = "v1";
export const description = "Detects if user is changing conversation direction (pivot).";
export const inputSchema = z.object({
  messages: z.array(z.object({ sender: z.string(), content: z.string() })),
  focus: z.string().optional(),
});
export const outputSchema = z.object({
  pivotDetected: z.boolean(),
  pivotType: z.enum(["hard", "soft", "none"]),
  newFocus: z.string().optional(),
});
🟨 HUMAN:

Each contract should be readable as a mini-API, with field comments explaining rationale and key invariants.
3. Prompt Versioning & Test Vectors
🟦 AGENT:

Every breaking prompt change increments the version.
Each prompt module must export (or include in similar named fixture/test files):
at least one valid input/output pair
at least one “bad case” for negative tests
Example
export const validInput = { messages: [{ sender: "user", content: "Change topic" }] };
export const validOutput = { pivotDetected: true, pivotType: "hard", newFocus: "new_topic" };
export const invalidOutput = { pivotDetected: "yes" }; // invalid: wrong type
🟨 HUMAN:

When introducing/changing a prompt, always update:
The registry
Contract schemas
Test vectors
4. Documentation & Usage Notes
🟦 AGENT:

Every prompt must clearly state:
What AgentState/context fields it requires
What it’s allowed to update (explicit element of output contract)
When in the workflow it should/should not be used
🟨 HUMAN:

Prompt doc files (.md or docstring) should show where this prompt fits in the overall workflow (see: Prompt-Router-Plan).
5. Good / Bad Practice Callouts (from Master Doc)
Good:
No inline, unversioned, untyped string prompts.
Adding, A/B testing, or rolling back a prompt is a matter of registry/contract config, not a codebase-wide refactor.
Prompt contract change always triggers contract test suite/code review.
All prompt usage is traceable in LangSmith/OTel.
Bad:
Prompt string change leads to uncontrolled behavior change.
Outputs are only asserted against “did it kind of work?”.
Prompts depend on state not covered in inputSchema.
6. Links/References
Master-Implementation-Plan.md
Agent-State-Implementation-Plan.md
Prompt-Router-Plan.md
