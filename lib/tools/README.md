# Tool Layer

Modular tools with contracts/registry, mirroring Prompts.

## Usage
```typescript
import { getToolExecutor } from '@tools/registry';

const executor = getToolExecutor('queryDb');
const update = await executor(state, 'queryDb');
```

## Files
- types.ts: ToolContract
- registry.ts: register/get
- query-db.contract.ts: Postgres query tool

Docs: [docs/Tool-Layer.md](docs/Tool-Layer.md)
