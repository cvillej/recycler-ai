# Recycler AI System Architecture

## Core Philosophy
**System is a state machine. Prompts are pure functions. Orchestrator owns truth.**

## Architectural Layers

### Layer 1: State Management (Foundation)
- **Purpose**: Define and manage explicit agent state
- **Technology**: Zod schemas, TypeScript types
- **Key Concept**: State is source of truth, not prompts

### Layer 2: Prompt System (Core Intelligence)
- **Purpose**: Modular prompting with hybrid routing
- **Technology**: Prompt registry, contracts, hybrid router
- **Key Concept**: Hard rules → state-based → LLM fallback routing

### Layer 3: Execution Engine
- **Purpose**: Execute prompt-driven workflows
- **Technology**: LangGraph JS
- **Key Concept**: Graph-based state machine execution

### Layer 4: Chat Transport
- **Purpose**: Stream events between agent and UI
- **Technology**: Next.js API Routes, Vercel AI SDK
- **Key Concept**: Real-time streaming of agent state

### Layer 5: User Interface
- **Purpose**: React-based chat interface
- **Technology**: Next.js, React, Vercel AI SDK UI
- **Key Concept**: UI as projection of agent state

### Layer 6: Observability
- **Purpose**: Tracing, debugging, monitoring
- **Technology**: OpenTelemetry, LangSmith (Docker), structured logging
- **Key Concept**: End-to-end traceability

## Detailed Component Design

### 1. Agent State Schema
```typescript
type AgentState = {
  // Conversation state
  messages: ChatMessage[];
  threadId: string;
  
  // Cognitive state
  focus: string | null;
  activeTask: string | null;
  needsIntentClassification: boolean;
  needsPivotCheck: boolean;
  
  // Workflow state
  queryPlan: QueryPlan | null;
  toolResults: ToolResults | null;
  readyToRespond: boolean;
  
  // Control state
  waitingForUser: boolean;
  requiresApproval: boolean;
  lastError: string | null;
  retryCount: number;
  
  // Memory state
  workingMemory: WorkingMemory[];
  userProfileMemory: UserProfileMemory[];
  derivedMemory: DerivedMemory[];
  
  // UI state
  uiArtifacts: UIArtifact[];
  pendingToolCalls: PendingToolCall[];
};
```

### 2. Prompt Registry Architecture
```
prompt-registry/
├── prompts/              # Versioned prompt files
│   ├── v1/
│   │   ├── classify-intent.prompt.md
│   │   ├── detect-pivot.prompt.md
│   │   ├── update-focus.prompt.md
│   │   ├── plan-query.prompt.md
│   │   ├── execute-tool-reasoning.prompt.md
│   │   ├── analyze-results.prompt.md
│   │   └── respond.prompt.md
│   └── v2/              # Future versions
├── contracts/           # Zod schemas for each prompt
│   ├── classify-intent.schema.ts
│   ├── detect-pivot.schema.ts
│   └── ...
├── registry.ts         # Prompt registry implementation
└── index.ts
```

### 3. Hybrid Router Design
```typescript
type RouteDecision = {
  nextPrompt: PromptName;
  source: "hard_rule" | "state" | "llm";
  reason: string;
  timestamp: Date;
};

class HybridRouter {
  // Layer 1: Hard rules (deterministic guards)
  private checkHardRules(state: AgentState): RouteDecision | null {
    if (state.requiresApproval) return { /* await_user */ };
    if (state.waitingForUser) return { /* await_user */ };
    if (state.lastError && state.retryCount >= 3) return { /* handle_error */ };
    return null;
  }
  
  // Layer 2: State-based routing
  private routeByState(state: AgentState): RouteDecision | null {
    if (state.needsIntentClassification) return { /* classify_intent */ };
    if (state.needsPivotCheck) return { /* detect_pivot */ };
    if (state.focus === "data_query" && !state.queryPlan) return { /* plan_query */ };
    // ... state-based logic
    return null;
  }
  
  // Layer 3: LLM fallback
  private async llmRoute(state: AgentState): Promise<RouteDecision> {
    // Constrained LLM call for ambiguity resolution only
  }
  
  public async selectNextPrompt(state: AgentState): Promise<RouteDecision> {
    // Try hard rules first
    const hardRule = this.checkHardRules(state);
    if (hardRule) return hardRule;
    
    // Try state-based routing
    const stateRoute = this.routeByState(state);
    if (stateRoute) return stateRoute;
    
    // Fall back to LLM routing
    return this.llmRoute(state);
  }
}
```

### 4. LangGraph Integration
```
langgraph-runtime/
├── graph/              # LangGraph state machine
│   ├── nodes/         # Individual graph nodes
│   ├── edges/         # Conditional edges
│   └── index.ts       # Graph definition
├── execution/          # Execution engine
├── persistence/        # Checkpoint storage
└── callbacks/         # LangSmith integration
```

### 5. Project Directory Structure
```
recycle-ai/
├── packages/           # Shared packages (monorepo)
│   ├── agent-state/    # Layer 1: State management
│   ├── prompt-registry/# Layer 2: Prompt system
│   ├── prompt-router/  # Layer 2: Hybrid routing
│   ├── langgraph-runtime/# Layer 3: Execution engine
│   ├── tools/          # Tool implementations
│   ├── observability/  # Layer 6: OpenTelemetry setup
│   └── types/          # Shared TypeScript types
├── apps/               # Applications
│   ├── web/           # Layer 5: Next.js frontend
│   └── api/           # Layer 4: Chat transport API
├── prompts/            # Actual prompt files (versioned)
├── docker/             # Docker configurations
│   └── langsmith/     # LangSmith Docker setup
├── Taskfile.yml        # Build/deploy tasks
├── package.json        # Root package.json
└── pnpm-workspace.yaml # pnpm workspace config
```

## Development Workflow

### 1. State-First Development
1. Define AgentState schema
2. Create prompt contracts (input/output schemas)
3. Implement prompts as pure functions
4. Build hybrid router
5. Integrate with LangGraph

### 2. Testing Strategy
- **Unit tests**: Individual prompts, router logic
- **Integration tests**: Prompt + router + state
- **E2E tests**: Full agent workflows
- **LangSmith trace validation**: Debug routing decisions

### 3. Deployment Strategy
- **Local development**: Docker Compose (LangSmith + app)
- **Staging**: Vercel preview deployments
- **Production**: Vercel production + monitoring

## Key Design Decisions

### 1. Monorepo with pnpm
- **Why**: Clear separation of concerns, shared types, efficient dependencies
- **Alternative**: Separate repos (more overhead)

### 2. Prompt Files as Markdown
- **Why**: Versionable, readable, separate from code
- **Alternative**: Inline strings (harder to manage)

### 3. Hybrid Router Priority
- **Why**: Hard rules → state → LLM ensures stability
- **Alternative**: Pure LLM routing (less predictable)

### 4. Explicit State Schema
- **Why**: Required for hybrid routing to work
- **Alternative**: Implicit state in prompts (brittle)

### 5. LangGraph over Plain LangChain
- **Why**: State machine, persistence, interrupts, streaming
- **Alternative**: LangChain only (less control)

## Success Metrics

### 1. Debuggability
- Can trace any response back to routing decisions
- Can compare prompt versions in LangSmith
- Can see state transitions clearly

### 2. Stability
- Hard rules prevent unsafe actions
- State-based routing ensures workflow consistency
- Contract validation prevents schema drift

### 3. Evolvability
- Prompts can be versioned and A/B tested
- Router logic can be extended without breaking changes
- State schema can evolve with migrations

## Next Steps

1. ✅ Read and understand architecture documents
2. 🟡 Design system architecture (this document)
3. ⬜ Create monorepo structure
4. ⬜ Implement AgentState schema
5. ⬜ Create prompt registry foundation
6. ⬜ Implement hybrid router
7. ⬜ Set up LangSmith Docker
8. ⬜ Create development Taskfile

## References
- [Tech Stack Approach](../initial-setup/tech-stack-and-approach.md)
- [Tracing Approach](../initial-setup/tracing-approach.md)
- [Prompting Philosophy](../initial-setup/prompting.md)
- [Prompt Selection Layer](../initial-setup/prompt-selection-lqyer.md)