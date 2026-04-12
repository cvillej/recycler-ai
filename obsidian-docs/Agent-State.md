---

title: Agent State Documentation
tags: [obsidian, recycle-ai, agent-state]
published: true
---

# Agent State Overview

The Agent State layer serves as the single source of truth for all reasoning processes within the Recycle AI system. It enforces clarity and determinism throughout the agent's operation by being explicit, schema-based, and extensible.

## Purpose
The Agent State maintains all context for user sessions and decision-making, ensuring a well-defined structure that supports debugging and testing.

## Explicit Implementation Requirements
### 1. Define AgentState Type/Schema
- Use TypeScript for type definition and Zod (or compatible) for runtime schema validation. All fields must avoid “catch-all” structures and instead use explicit types.

### 2. Organizational Standards
- Keys must be versioned and grouped logically. The schema should make it easy for new contributors to understand the underlying structure at a glance.

### 3. Schema Example
```typescript
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
    workingMemory: z.any().optional(),
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
```

## Good Practices
- Each schema field MUST exclusively define what is relevant to prompts, tools, and workflow state.
- Testing must be built into the development process with clear boundaries for valid and invalid states.

## Related Topics
- For understanding prompt characteristics and how they interact with Agent State, see [[Prompt System]].
- For handling control flows, check [[Hybrid Prompt Router]].

---
