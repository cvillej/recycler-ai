'use client';

import { useChat } from 'ai/react';

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, reload } = useChat({
    api: '/api/chat',
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Recycler AI Chat (Streaming + Observability Ready)</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => reload()}>New Thread</button>
        <span>Loading: {isLoading ? 'Yes' : 'No'}</span>
        {error && <span style={{ color: 'red' }}>Error: {error.message}</span>}
      </div>
      <div style={{ height: '400px', border: '1px solid #ccc', padding: '10px', overflowY: 'auto', marginBottom: '10px' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: '10px', textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            style={{ flex: 1 }}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </button>
        </div>
      </form>
      <p style={{ fontSize: '0.8em', color: '#666', marginTop: '10px' }}>
        Streaming chat via /api/chat + LangGraph. Traces in LangSmith (set LANGCHAIN_TRACING_V2=true).
      </p>
    </div>
  );
}
