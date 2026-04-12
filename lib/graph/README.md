# LangGraph Execution Engine

The orchestrator that ties together State, Router, and Prompts into executable AI agent workflows using [LangGraph.js](https://langchain-ai.github.io/langgraph/).

## Architecture

```
[Input] → StateGraph (AgentState channels) → [Nodes: router | prompts] → [Edges: conditional] → [Output/Checkpoints]
                 ↑
              Checkpointer (MemorySaver/Postgres)
```

- **State**: `AgentState` with typed channels and reducers (`lib/state/schema.ts`)
- **Nodes**:
  - `router`: `HybridRouter.selectNextPrompt()`
  - `promptName`: `getPromptExecutor(promptName).execute()`
- **Edges**: Conditional based on `state.nextPrompt`
- **Interrupts**: Before `await_user` for human-in-the-loop
- **Persistence**: LangGraph checkpoints via `createOrchestrator()`

## Usage

```typescript
import { createOrchestrator, invokeGraph } from './index';

const config: GraphConfig = {
  proxyBaseURL: process.env.OPENROUTER_PROXY_URL!,
  llmModel: 'openai/gpt-4o-mini',
  checkpointer: new MemorySaver(), // or PostgresSaver
  enableInterrupts: true,
};

const graph = createOrchestrator(config);
const result = await invokeGraph(
  { messages: [{ role: 'user', content: 'Hello!' }] },
  config
);
```

## Key Files

| File | Purpose |
|------|---------|
| `types.ts` | `GraphConfig`, `GraphInput/Output` |
| `builder.ts` | `buildExecutionGraph()` - assembles graph |
| `nodes.ts` | Node factories (`createRouterNode`, `createPromptNode`) |
| `index.ts` | `createOrchestrator()`, `invokeGraph()`, `resumeGraph()` |
| `graph.test.ts` | End-to-end workflow tests |

## Integration

- **Chat Transport**: Call `invokeGraph()` per user message
- **API Routes**: Expose `resumeGraph(threadId, input)`
- **Extensibility**: Add nodes/edges in `builder.ts`, register prompts dynamically

## Design Principles

- **Pure Functions**: Nodes mutate `AgentState` in-place (LangGraph convention)
- **Dynamic Nodes**: Prompt nodes auto-generated from registry
- **Type-Safe**: Full TS inference from Zod schemas
- **Tested**: 100% coverage for flows, errors, interrupts

## Docs Graph

Start here: [`obsidian-docs/Home.md`](/Users/jfortney/dev/recycle-ai/new-docs/00%20-%20Maps%20of%20Content/Recycler%20AI%20Overview.md)

Follow links:
- [`new-docs/04 - Permanent/Architecture/Execution Engine.md`]
- [`new-docs/03 - Transients/Implementation/04 - LangGraph Execution Engine.md`]

## Next Steps

- Integrate with Next.js API routes (`app/api/chat/route.ts`)
- Add Postgres checkpointer for production
- Streaming support (`streamGraph()`)
