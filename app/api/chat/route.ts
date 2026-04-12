'use server';

import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { invokeGraph } from '../../../lib/graph';
import { generateUUID } from '../../../lib/state/schema';
import type { GraphConfig, GraphInput } from '../../../lib/graph/types';

const config: GraphConfig = {
  proxyBaseURL: process.env.OPENROUTER_PROXY_URL || 'http://localhost:3000',
  llmModel: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
  checkpointer: null,
  enableInterrupts: true,
};

export async function POST(req: NextRequest) {
  try {
    const { messages, threadId } = await req.json() as { messages: Array<{ role: string; content: string }>; threadId?: string };

    const input: GraphInput = {
      messages,
      threadId: threadId || generateUUID(),
    };

    const result = await invokeGraph(input, config);

    // For streaming, wrap in generator (future: streamGraph)
    const stream = streamText({
      model: config.llmModel,
      generate: async () => ({
        text: result.finalMessage,
      }),
    });

    return stream.toAIStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
