import { z } from 'zod';
import type { AgentState } from '../state/schema';
import type { PromptName } from '../router/types';

/**
 * Prompt System Types
 *
 * For documentation, start at:
 * - `new-docs/00 - Maps of Content/Recycler AI Overview.md`
 * - `new-docs/04 - Permanent/Architecture/Prompt System.md`
 */

/**
 * Version string for prompts (e.g., 'v1', 'v2').
 */
export type PromptVersion = `v${number}`;

/**
 * Contract for a prompt module.
 * Defines input/output schemas, version, and metadata.
 *
 * Prompts are pure functions: they receive validated input derived from
 * AgentState and return a validated output to be merged back into state.
 *
 * @template TInput - Zod schema for the prompt's input.
 * @template TOutput - Zod schema for the prompt's output.
 */
export interface PromptContract<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
> {
  /** The unique name of the prompt (from the router's whitelist). */
  name: PromptName;

  /** The version of this prompt contract. */
  version: PromptVersion;

  /** A brief description of the prompt's purpose. */
  description: string;

  /** Zod schema for validating the prompt's input. */
  inputSchema: TInput;

  /** Zod schema for validating the prompt's output. */
  outputSchema: TOutput;

  /**
   * Pure function to derive the prompt's input from the full AgentState.
   * This ensures the prompt only receives the data it needs.
   */
  deriveInput: (state: AgentState) => z.infer<TInput>;

  /**
   * Pure function to merge the prompt's validated output back into the AgentState.
   * This returns a partial state that will be merged by the execution engine.
   * It should never mutate the original state.
   */
  mergeOutput: (
    output: z.infer<TOutput>,
    currentState: AgentState
  ) => Partial<AgentState>;

  /**
   * The prompt template (string or function).
   * If a function, it receives the validated input.
   */
  template: string | ((input: z.infer<TInput>) => string);

  /** Test vectors for validating the prompt's behavior. */
  testVectors: {
    validInput: z.infer<TInput>;
    validOutput: z.infer<TOutput>;
    invalidInput?: unknown;
    invalidOutput?: unknown;
  };
}

/**
 * A function that executes a prompt based on its contract.
 * This is the runtime representation of a prompt in the registry.
 */
export type PromptExecutor = (
  state: AgentState,
  config?: {
    proxyBaseURL?: string;
    llmModel?: string;
  }
) => Promise<Partial<AgentState>>;

/**
 * An entry in the prompt registry.
 */
export interface RegistryEntry {
  contract: PromptContract<any, any>;
  execute: PromptExecutor;
}
