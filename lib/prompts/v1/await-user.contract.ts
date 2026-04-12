import { z } from 'zod';
import type { PromptContract } from '../types';
import type { AgentState } from '../../state/schema';

// --- Input Schema ---
const AwaitUserInputSchema = z.object({
  lastAssistantMessage: z.string(),
});

// --- Output Schema ---
const AwaitUserOutputSchema = z.object({
  // This prompt doesn't call an LLM, so output is empty
});

// --- Prompt Contract ---
export const awaitUserContract: PromptContract<
  typeof AwaitUserInputSchema,
  typeof AwaitUserOutputSchema
> = {
  name: 'await_user',
  version: 'v1',
  description: 'A no-op prompt that waits for user input. Used by hard rules.',

  inputSchema: AwaitUserInputSchema,
  outputSchema: AwaitUserOutputSchema,

  deriveInput: (state: AgentState) => ({
    lastAssistantMessage: state.messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || 'Awaiting input.',
  }),

  // This is a special case; the executor should short-circuit
  mergeOutput: (_output, currentState) => ({
    ...currentState, // No change
  }),

  // This template is not executed by an LLM
  template: 'This is a system state; no LLM call is made.',

  testVectors: {
    validInput: { lastAssistantMessage: 'Please confirm.' },
    validOutput: {},
  },
};
