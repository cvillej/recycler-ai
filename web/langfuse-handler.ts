/**
 * web/langfuse-handler.ts - Langfuse integration for TS LangGraph.
 * Unified traces with aiproxy: sessionId = threadId.
 * See architecture.md §5.4.
 */
import { Langfuse } from '@langfuse/core'  // or @langfuse/langchain ^2.0 for LC compat

const handler = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  host: process.env.LANGFUSE_HOST || 'http://localhost:3000',
  debug: true,
})

export const langfuseHandler = handler.handler()

// Usage in LangGraph node:
import { ChatOpenAI } from '@langchain/openai'

const llm = new ChatOpenAI({
  model: 'grok-beta',
  baseUrl: 'http://localhost:4000/v1',  // aiproxy
  extraBody: {
    metadata: { thread_id: currentThreadId }
  },
  callbacks: [langfuseHandler],  // sessionId auto from env or set manually
})

// Set sessionId explicitly
handler.flush({
  sessionId: currentThreadId,
})

// After response
const headers = response.response?.headers
const selectedModel = headers?.['x-litellm-selected-model']
console.log(`Selected: ${selectedModel}, Tools: ${headers?.['x-litellm-selected-tools']}`)

// Install: npm i @langfuse/core @langfuse/langchain langchain-openai