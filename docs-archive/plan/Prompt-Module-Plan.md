# Prompt Implementations via Registry

**Reference:** [Master-Implementation-Plan.md](../master-plan.md)

## Purpose

The Prompt Implementations layer defines the specific prompts that the agent will use as cognitive functions. Each prompt is a modular component that performs a distinct task, allowing for greater flexibility, reusability, and manageability.

---

## Scope

- Each prompt is defined as its own versioned module, independently managed and maintained.
- Every module must specify an input and output contract, along with a clear description of its function.
- Prompts are stored in a registry, allowing for easy discovery, versioning, and contract enforcement.

---

## Explicit Implementation Requirements

### 1. Prompt Module Structure

**🟦 AGENT:**
- Each tool should be defined as a separate module with:
  - File structure that includes `.ts` for logic and `.contract.ts` for schema definitions.
  - Clear versioning through naming conventions.

#### Example Structure

```
prompts/
  v1/
    classify-intent.prompt.md        # Prompt text and description
    classify-intent.contract.ts       # Input/output schemas
    detect-pivot.prompt.md            # Prompt text and description
    detect-pivot.contract.ts           # Input/output schemas
    ...
```

---

### 2. Core Prompt Set

A minimal set for a robust agent (as supported by the docs, registry, and router):

- `classify_intent`
- `detect_pivot`
- `update_focus`
- `plan_next_step`
- `execute_tool_reasoning`
- `analyze_results`
- `respond`
- (`handle_error`, `ask_clarification`, ... as needed)

---

### 3. Prompt Contract Requirements

- **inputSchema**: Must validate all LLM/tool input, checked before invocation.
- **outputSchema**: Must validate LLM/tool output, checked after invocation.
- Both schemas should use Zod, JSON-schema, or equivalent.
- Prompt module may export example test vectors.

#### Example contract file

```typescript
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
```

---

### 4. Prompt Design & Contracts

- **🟦 AGENT:**
  - No prompt may accept or return free-form stringified state ("blob struct" pattern forbidden).
  - Input/Output contracts must always be enforced in runtime agent execution and in all A/B evaluation.

---

### 5. Test Vectors/Fixtures

- Each file must export:
  - At least one valid input and output example
  - One "bad case" misuse input

#### Example:

```typescript
// Test Vectors
export const validInput = {
  messages: [{ sender: "user", content: "Can I check my order status?" }],
  focus: null
};

export const validOutput = { intent: "order_query", confidence: 0.96 };
export const invalidOutput = { intent: 5 }; // invalid: wrong type
```

---

### 6. Documentation & Usage Notes

- Every prompt must clearly state:
  - What AgentState/context fields it requires
  - What it’s allowed to update
  - When in the workflow it should/should not be used

---

### 7. Good / Bad Practice Callouts (from Master Doc)

- **Good:**  
  - No inline, unversioned, untyped string prompts.  
  - Adding, A/B testing, or rolling back a prompt is a matter of registry/contract config, not a codebase-wide refactor.
- **Bad:**  
  - Prompt string change leads to uncontrolled behavior change.  
  - Only the LLM knows what the current state is.

---

### 8. Links/References

- [Master-Implementation-Plan.md](../master-plan.md)
- [Agent-State-Implementation-Plan.md](Agent-State-Implementation-Plan.md)
- [Hybrid-Prompt-Router-Plan.md](../Hybrid-Prompt-Router-Plan.md)
