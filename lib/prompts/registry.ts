import { z } from 'zod';
import type { PromptName } from '../router/types';
import type { RegistryEntry, PromptExecutor, PromptContract } from './types';
import { createPromptExecutor } from './executor';

/**
 * Prompt Registry
 *
 * Centralized mapping of PromptName@version to its contract and executor.
 *
 * For documentation, start at:
 * - `new-docs/00 - Maps of Content/Recycler AI Overview.md`
 * - `new-docs/04 - Permanent/Architecture/Prompt System.md`
 */
const promptRegistry = new Map<string, RegistryEntry>();

/**
 * Register a prompt contract with the system.
 * This populates the registry and creates a runtime executor.
 *
 * @param contract - The prompt contract to register.
 */
export function registerPrompt<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny
>(contract: PromptContract<TInput, TOutput>): void {
  const key = `${contract.name}@${contract.version}`;
  if (promptRegistry.has(key)) {
    console.warn(`[PromptRegistry] Overwriting prompt: ${key}`);
  }
  promptRegistry.set(key, {
    contract,
    execute: createPromptExecutor(contract),
  });
}

/**
 * Retrieve a prompt executor from the registry.
 *
 * @param name - The name of the prompt.
 * @param version - The version to retrieve (default: 'v1').
 * @returns The prompt executor function.
 * @throws {Error} if the prompt is not found.
 */
export function getPromptExecutor(
  name: PromptName,
  version: string = 'v1'
): PromptExecutor {
  const key = `${name}@${version}`;
  const entry = promptRegistry.get(key);
  if (!entry) {
    throw new Error(`[PromptRegistry] Prompt not found: ${key}`);
  }
  return entry.execute;
}

/**
 * Retrieve a prompt contract from the registry.
 *
 * @param name - The name of the prompt.
 * @param version - The version to retrieve (default: 'v1').
 * @returns The prompt contract.
 * @throws {Error} if the prompt is not found.
 */
export function getPromptContract(
  name: PromptName,
  version: string = 'v1'
): PromptContract<any, any> {
  const key = `${name}@${version}`;
  const entry = promptRegistry.get(key);
  if (!entry) {
    throw new Error(`[PromptRegistry] Prompt contract not found: ${key}`);
  }
  return entry.contract;
}

/**
 * Get all registered prompt keys (e.g., 'classify_intent@v1').
 */
export function listRegisteredPrompts(): string[] {
  return Array.from(promptRegistry.keys());
}

// --- Auto-register prompts ---
import { classifyIntentContract } from './v1/classify-intent.contract';
import { respondContract } from './v1/respond.contract';
import { awaitUserContract } from './v1/await-user.contract';

registerPrompt(classifyIntentContract);
registerPrompt(respondContract);
registerPrompt(awaitUserContract);
