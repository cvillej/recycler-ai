import { z } from 'zod';
import type { PromptContract } from '../types';
import type { AgentState } from '../../state/schema';

// --- Input Schema ---
const ClassifyIntentInputSchema = z.object({
  lastUserMessage: z.string(),
  conversationHistory: z.array(z.string()),
  availableTools: z.array(z.string()),
});

// --- Output Schema ---
const ClassifyIntentOutputSchema = z.object({
  intent: z.string().describe('The user\'s primary intent.'),
  confidence: z.number().min(0).max(1),
  nextBestAction: z.string().optional().describe('Suggested next action for the system.'),
});

// --- Prompt Contract ---
export const classifyIntentContract: PromptContract<
  typeof ClassifyIntentInputSchema,
  typeof ClassifyIntentOutputSchema
> = {
  name: 'classify_intent',
  version: 'v1',
  description: 'Classifies the user\'s intent based on the last message and conversation history.',

  inputSchema: ClassifyIntentInputSchema,
  outputSchema: ClassifyIntentOutputSchema,

  deriveInput: (state: AgentState) => ({
    lastUserMessage: state.messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '',
    conversationHistory: state.messages.map(m => `${m.role}: ${m.content}`),
    availableTools: (state.context.availableTools as string[]) || [],
  }),

  mergeOutput: (output, currentState) => ({
    context: {
      ...currentState.context,
      intent: output.intent,
      intentConfidence: output.confidence,
      nextBestAction: output.nextBestAction,
      needsIntentClassification: false, // Mark as complete
    },
  }),

  template: (input) => `You are an intent classification expert for an AI assistant.
Your task is to analyze the conversation and determine the user's primary intent.

Available tools: ${input.availableTools.join(', ')}
Conversation history:
${input.conversationHistory.join('\n')}

Based on the last user message, classify the intent.
Respond with a JSON object: { "intent": "<intent>", "confidence": <0-1>, "nextBestAction": "<action>" }

Last user message: "${input.lastUserMessage}"`,

  testVectors: {
    validInput: {
      lastUserMessage: 'What is the weather in London?',
      conversationHistory: ['user: Hi', 'assistant: Hello!'],
      availableTools: ['weather_api'],
    },
    validOutput: {
      intent: 'get_weather',
      confidence: 0.95,
      nextBestAction: 'call_weather_api',
    },
  },
};
