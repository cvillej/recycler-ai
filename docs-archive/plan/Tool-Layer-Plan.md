# Tool Layer

**Reference:** [Master-Implementation-Plan.md](../master-plan.md)

## Purpose

The Tool Layer provides the mechanisms for executing external interactions in a controlled, observant manner. This layer ensures tools invoked by the agent are secure, type-checked, and function correctly within the overall architecture.

---

## Scope

- Each tool is separately defined as a module with strict contracts for input/output.
- All tools must be registered in a centralized tool registry to facilitate versioning, validation, and usage tracking.
- Tool executions should be logged and traceable to maintain visibility and debuggability throughout the system.

---

## Explicit Implementation Requirements

### 1. Tool Module Structure

**🟦 AGENT:**
- Each tool should be defined as a separate module with:
  - File structure that includes `.ts` for logic and `.contract.ts` for schema definitions.
  - Clear versioning through naming conventions.

#### Example Structure

```
tools/
  queryOrderStatus.tool.ts
  createUser.tool.ts
  ...
```

---

### 2. Tool Definition & Contracts

**🟦 AGENT:**
- Each tool must specify:
  - `inputSchema`: Zod/JSON-schema definition for expected input.
  - `outputSchema`: Zod/JSON-schema definition for expected output.
  - Comprehensive documentation on expected use cases and any special handling.

#### Example Tool Contract

```typescript
import { z } from "zod";

export const version = "v1";
export const description = "Fetches an order status based on user input.";

export const inputSchema = z.object({
  userId: z.string(),
  orderId: z.string(),
});

export const outputSchema = z.object({
  status: z.enum(["pending", "shipped", "delivered", "cancelled"]),
  eta: z.string().optional(),
  error: z.string().optional(),
});

export async function queryOrderStatus(input: z.infer<typeof inputSchema>) {
  // Implementation logic to query order status from a database or service.
  return { status: "shipped", eta: "2026-04-11" };
}
```

---

### 3. Input/Output Validation

**🟦 AGENT:**
- All inputs and outputs must be validated against their respective schemas before and after execution using contract schemas.
- This prevents unexpected behavior from poorly formed requests.

#### Example Validation Code:

```typescript
function safeInvokeTool(tool, input) {
  const parsedInput = tool.inputSchema.parse(input);
  const output = await tool.toolFunction(parsedInput);
  tool.outputSchema.parse(output); // Throws/test fails if invalid
  return output;
}
```

---

### 4. Tool Registration

**🟦 AGENT:**
- Define a central `toolRegistry` object that maps tool names (with versions) to their respective implementations.
- This registry allows for easy access and documentation for all tool functionalities.

#### Example Tool Registry:

```typescript
import * as QueryOrderStatus from './queryOrderStatus.tool';

export const toolRegistry = {
  "queryOrderStatus@v1": QueryOrderStatus,
  // Add other tools here
};
```

---

### 5. Logging and Auditing

**🟦 AGENT:**
- All tool invocations must log:
  - Request parameters
  - Execution time
  - Result or error messages
  - Input/output state

#### Example Log Entry:

```json
{
  "tool": "queryOrderStatus",
  "input": {
    "userId": "12345",
    "orderId": "abcde"
  },
  "output": {
    "status": "shipped",
    "eta": "2026-04-11",
    "error": null
  },
  "executionTime": "30ms"
}
```

---

### 6. Test Vectors for Tool Operations

**🟦 AGENT:**
- Each tool must include test coverage that ensures valid and invalid inputs yield the expected results.
- Tests should run as part of the CI pipeline.

#### Example Test Cases:

```typescript
const tests = [
  {
    input: { userId: "12345", orderId: "abcde" },
    expect: { status: "shipped", eta: "2026-04-11" }
  },
  {
    input: { userId: "", orderId: "not_found" },
    expect: { error: "User ID is required." }
  }
];
```

---

### 7. Good / Bad Practice Callouts

- **Good:**  
  - Every tool is type-checked, traced, versioned, with clear contracts and audit hooks.
  - No direct AgentState mutation; only controlled by graph transitions after output.
- **Bad:**  
  - “Black box” tools invoked with generic objects/text.
  - No logging or weak validations leading to obscure errors.
  
---

### 8. Links/References

- [Master-Implementation-Plan.md](../master-plan.md)
- [Agent-State-Implementation-Plan.md](Agent-State-Implementation-Plan.md)
- [Prompt-Module-Plan.md](Prompt-Module-Plan.md)
- [Hybrid-Prompt-Router-Plan.md](Hybrid-Prompt-Router-Plan.md)

---

## ✅ Section 6 Complete: Tool Layer

