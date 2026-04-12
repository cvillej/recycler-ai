import { z } from 'zod';
import type { ToolContract, ToolExecutor, RegistryEntry } from './types';
import { createToolExecutor } from './executor'; // Future

const toolRegistry = new Map<string, RegistryEntry>();

export function registerTool<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
  contract: ToolContract<TInput, TOutput>
): void {
  const key = `${contract.name}@${contract.version}`;
  if (toolRegistry.has(key)) {
    console.warn(`[ToolRegistry] Overwriting tool: ${key}`);
  }
  toolRegistry.set(key, {
    contract,
    execute: createToolExecutor(contract),
  });
}

export function getToolExecutor(name: string, version: string = 'v1'): ToolExecutor {
  const key = `${name}@${version}`;
  const entry = toolRegistry.get(key);
  if (!entry) {
    throw new Error(`Tool ${name}@${version} not registered`);
  }
  return entry.execute;
}

export function listRegisteredTools(): string[] {
  return Array.from(toolRegistry.keys());
}

// Auto-register
import { queryDbContract } from './query-db.contract';
registerTool(queryDbContract);
