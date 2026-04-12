import { z } from 'zod';
import type { PromptContract } from './types';
import type { AgentState } from '../state/schema';

/**
 * Creates a generic executor function for a given prompt contract.
 *
 * This function encapsulates the "pure function" pattern:
 * 1. Derives and validates input from the current state.
 * 2. Renders the prompt template.
 * 3. Calls the LLM (via proxy).
 * 4. Validates the LLM's output against the output schema.
 * 5. Merges the validated output back into a new partial state.
 *
 * @param contract - The prompt contract.
 * @returns An async function that takes AgentState and returns a partial AgentState update.
 */
export function createPromptExecutor<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny
>(
  contract: PromptContract<TInput, TOutput>
): (state: AgentState, config?: { proxyBaseURL?: string; llmModel?: string }) => Promise<Partial<AgentState>> {
  return async (
    state: AgentState,
    config = {}
  ): Promise<Partial<AgentState>> => {
    const {
      proxyBaseURL = 'http://localhost:3000',
      llmModel = 'openai/gpt-4o',
    } = config;

    // 1. Derive and validate input
    const input = contract.deriveInput(state);
    const validatedInput = contract.inputSchema.parse(input);

    // 2. Render the prompt template
    const promptText = typeof contract.template === 'function'
      ? contract.template(validatedInput)
      : contract.template;

    const messages = [
      { role: 'system' as const, content: promptText },
      { role: 'user' as const, content: `Input data: ${JSON.stringify(validatedInput)}` },
    ];

    try {
      // 3. Call the LLM (via proxy)
      const response = await fetch(`${proxyBaseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: llmModel,
          messages,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM proxy returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM response missing content');
      }

      const parsedContent = JSON.parse(content);

      // 4. Validate the LLM's output
      const validatedOutput = contract.outputSchema.parse(parsedContent);

      // 5. Merge the validated output back into state
      const stateUpdate = contract.mergeOutput(validatedOutput, state);

      return stateUpdate;
    } catch (error) {
      console.error(`[PromptExecutor:${contract.name}] Error:`, error);
      // Return a partial state update with the error
      return {
        lastError: {
          message: `Prompt execution failed for ${contract.name}: ${error instanceof Error ? error.message : String(error)}`,
          code: 'PROMPT_EXECUTION_FAILED',
          timestamp: new Date().toISOString(),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  };
}