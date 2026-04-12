# Extensibility Guidance

## State Schema Evolution and Checkpoint Migration

When evolving the state schema, consider the following:

1. **Version Increment**: Every breaking change must increment the schema version.
2. **Migration Functions**: Implement migration functions to transition between versions. These functions should handle existing state objects and transform them to the new schema.
3. **Checkpoint Compatibility**: Ensure that LangGraph checkpoints are compatible with the new schema version. Store a schema version identifier in each checkpoint.

### Example Migration Function

```typescript
function migrateToV2(oldState: AgentStateV1): AgentStateV2 {
  // Example transformation logic
  return {
    ...oldState,
    newField: initializeNewField(),
  };
}
```

## Prompt Registry A/B Testing and Canary Routing

1. **Registry-driven Experiments**: Leverage versioned prompt keys to route traffic for experimentation.
2. **Traffic Splitting**: Implement traffic splitting in the router to facilitate A/B tests.

### Sample A/B Testing Pattern

```typescript
function selectNextPrompt(state: AgentState): RouteDecision {
  if (Math.random() < 0.1) {
    return { nextPrompt: 'classify_intent@v1-experiment', source: 'state', reason: 'A/B test' };
  }
  return { nextPrompt: 'classify_intent@v1', source: 'state', reason: 'Standard flow' };
}
```

## Hybrid Router Extension Points

1. **Custom Rules**: Add new hard or state-based rules as the system evolves.
2. **Extensible Methodology**: Introduce methods like `checkCustomRules(state)` to allow for clean extensions.

```typescript
class HybridRouter {
  private checkCustomRules(state: AgentState): RouteDecision | null {
    // Define custom routing logic
    return null;
  }
}
```

## Graph Evolution Patterns

1. **Modular Node Design**: Each node should encapsulate distinct logic and be easily replaceable.
2. **Edge Strategy**: Clearly define edge conditions and document logic for branching.

### Graph Node Example

```typescript
class GraphNode {
  constructor(public logic: NodeLogic) {}
  execute(state: AgentState) {
    return this.logic(state);
  }
}
```

With this guidance, maintainability and scalability are ensured as new features and capabilities are added to the system.