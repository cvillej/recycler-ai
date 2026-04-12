 'use client';

import React, { useState, useCallback } from 'react';
import { invokeGraph } from '@graph';
import { generateUUID, type Message } from '@state/schema';
import type { RouterState } from '@router/types';

const config: GraphConfig = {
  proxyBaseURL: 'http://localhost:3000', // Run openrouter-proxy.js
  llmModel: 'openai/gpt-4o-mini',
  checkpointer: null,
  enableInterrupts: true,
};

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState(() => generateUUID());
  const [phase, setPhase] = useState<RouterState['phase']>('hard-rule');
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    const userMessage: Message = {
      id: generateUUID(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput('');

    try {
      const result = await invokeGraph(
        { messages: currentMessages.map(m => ({ role: m.role, content: m.content })), threadId },
        config
      );

      setMessages(result.state.messages);
      setPhase(result.state.routerState.phase);
    } catch (error) {
      console.error('Graph invocation failed:', error);
    } finally {
      setLoading(false);
    }
  }, [input, messages, threadId, loading]);

  const newThread = () => {
    setThreadId(generateUUID());
    setMessages([]);
    setPhase('hard-rule');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Recycler AI Demo (LangGraph Integrated)</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={newThread}>New Thread</button>
        <span>Phase: <strong>{phase}</strong></span>
        <span>Thread: <code>{threadId.slice(0,8)}...</code></span>
      </div>
      <div style={{ height: '400px', border: '1px solid #ccc', padding: '10px', overflowY: 'auto', marginBottom: '10px' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '10px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
        {loading && <div>Loading...</div>}
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          style={{ flex: 1 }}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
      <p style={{ fontSize: '0.8em', color: '#666', marginTop: '10px' }}>
        Demo: router → classify_intent → respond. Run `openrouter-proxy.js` for LLM calls.
      </p>
    </div>
  );
};

export default Home;
