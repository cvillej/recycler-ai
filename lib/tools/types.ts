import { z } from 'zod';
import type { AgentState } from '../state/schema';

/**
 * Tool Layer Types
 *
 * Mirror Prompt System contracts for tools.
 * For docs: [docs/Tool-Layer.md](docs/Tool-Layer.md)
 */

export type ToolVersion = `v${number}`;

export interface ToolContract<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny> {
  name: string;
  version: ToolVersion;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  execute: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
  testVectors: Array<{
    validInput: z.infer<TInput>;
    validOutput: z.infer<TOutput>;
    invalidInput?: unknown;
  }>;
}

export type ToolExecutor = (state: AgentState, toolName: string) => Promise<Partial<AgentState>>;

export interface RegistryEntry {
  contract: ToolContract<any, any>;
  execute: ToolExecutor;
}
