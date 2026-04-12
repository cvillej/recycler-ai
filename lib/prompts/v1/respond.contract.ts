import { z } from 'zod';
import { generateUUID } from '../../state/schema';
import type { PromptContract } from '../types';
import type { AgentState } from '../../state/schema';

// --- Input Schema ---
const RespondInputSchema = z.object({
  analysis: z.string(),
  toolResults: z.record(z.unknown()).optional(),
  conversationSummary: z.string(),
});

// --- Output Schema ---
const RespondOutputSchema = z.object({
  response: z.string().describe('The final, user-facing response.'),
  isTerminal: z.boolean().describe('Whether the conversation should end here.'),
});

// --- Prompt Contract ---
export const respondContract: PromptContract<
  typeof RespondInputSchema,
  typeof RespondOutputSchema
> = {
  name: 'respond',
  version: 'v1',
  description: 'Generates a final response to the user based on analysis and tool results.',

  inputSchema: RespondInputSchema,
  outputSchema: RespondOutputSchema,

  deriveInput: (state: AgentState) => ({
    analysis: (state.context.analysis as string) || 'No analysis provided.',
    toolResults: (state.context.toolResults as Record<string, unknown>) || undefined,
    conversationSummary: (state.context.summary as string) || 'No summary.',
  }),

  mergeOutput: (output, currentState) => ({
    messages: [
      ...currentState.messages,
      {
        id: generateUUID(),
        role: 'assistant',
        content: output.response,
        timestamp: new Date().toISOString(),
      },
    ],
    metadata: {
      ...currentState.metadata,
      terminal: output.isTerminal,
    },
    context: {
      ...currentState.context,
      readyToRespond: false, // Mark as complete
    },
  }),

  template: (input) => `You are a helpful AI assistant.
Your task is to generate a final, user-facing response.
Base your response on the provided analysis, tool results, and conversation summary.
Be clear, concise, and helpful.

Analysis: ${input.analysis}
Tool Results: ${JSON.stringify(input.toolResults, null, 2)}
Summary: ${input.conversationSummary}

Respond with a JSON object: { "response": "<final response>", "isTerminal": <true/false> }`,

  testVectors: {
    validInput: {
      analysis: 'The user wants to know the weather. The API returned 25°C.',
      toolResults: { temp: '25°C', condition: 'sunny' },
      conversationSummary: 'The user asked about the weather in London.',
    },
    validOutput: {
      response: 'The weather in London is sunny with a temperature of 25°C.',
      isTerminal: true,
    },
  },
};
