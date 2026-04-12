---
title: Agent State Documentation
tags: [obsidian, recycle-ai, agent-state]
published: true
---

# Agent State Overview

The Agent State layer serves as the **single source of truth** for all reasoning processes. Explicit, schema-based, extensible with Zod/TS.

## Purpose
Defines and manages explicit agent state using Zod schemas and TypeScript types. State is the source of truth, not prompts.

## Key Concepts
- State is the source of truth, not prompts.
- Utilizes Zod schemas for type enforcement.

## Explicit Implementation Requirements
### 1. Define AgentState Type/Schema
- Use TypeScript for type definition and Zod for runtime validation. Avoid catch-all structures.

### 2. Organizational Standards
- Keys versioned, grouped logically.

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
- Each field relevant to prompts/tools/workflow.
- Testing for valid/invalid states.

## Related Topics
- [[Prompt System]]
- [[Hybrid Prompt Router]]
- [[State Schema Evolution]]