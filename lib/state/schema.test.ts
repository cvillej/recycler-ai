import { describe, expect, test } from '@jest/globals';
import {
  AgentStateSchema,
  type AgentState,
  MessageSchema,
  RouterStateSchema,
  createInitialState,
  parseAgentState,
  safeParseAgentState,
  migrateV1ToV2,
  parseWithMigration,
  createCheckpoint,
  loadCheckpoint,
} from './schema';

describe('AgentState Schema', () => {
  const validThreadId = '123e4567-e89b-12d3-a456-426614174000';

  const minimalValidState: AgentState = {
    version: '1.0',
    threadId: validThreadId,
    messages: [],
    context: {},
    routerState: {
      pivotSignals: [],
      requiresApproval: false,
      phase: 'hard-rule',
    },
    metadata: {},
  };

  const fullValidState: AgentState = {
    version: '1.0',
    threadId: validThreadId,
    messages: [
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        role: 'user',
        content: 'Hello, world!',
        timestamp: '2026-04-12T10:00:00Z',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: '2026-04-12T10:00:05Z',
        metadata: { tokens: 42 },
      },
    ],
    context: {
      userName: 'Alice',
      topic: 'greetings',
    },
    routerState: {
      pivotSignals: ['userChangedTopic'],
      requiresApproval: false,
      phase: 'state-based',
      lastDecision: {
        ruleId: 'rule-123',
        confidence: 0.9,
        timestamp: '2026-04-12T10:00:04Z',
      },
    },
    metadata: {
      sessionStart: '2026-04-12T09:55:00Z',
    },
    lastError: {
      message: 'Network timeout',
      code: 'NETWORK_ERR',
      timestamp: '2026-04-12T09:58:00Z',
      stack: 'Error: fetch failed...',
    },
  };

  test('validates minimal valid state', () => {
    expect(() => parseAgentState(minimalValidState)).not.toThrow();
    const result = safeParseAgentState(minimalValidState);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(minimalValidState);
    }
  });

  test('validates full valid state', () => {
    expect(() => parseAgentState(fullValidState)).not.toThrow();
  });

  test('rejects missing version', () => {
    const invalid = { ...minimalValidState, version: undefined };
    const result = safeParseAgentState(invalid);
    expect(result.success).toBe(false);
  });

  test('rejects wrong version literal', () => {
    const invalid = { ...minimalValidState, version: '2.0' };
    const result = safeParseAgentState(invalid);
    expect(result.success).toBe(false);
  });

  test('rejects invalid threadId (not UUID)', () => {
    const invalid = { ...minimalValidState, threadId: 'not-a-uuid' };
    const result = safeParseAgentState(invalid);
    expect(result.success).toBe(false);
  });

  test('rejects messages out of chronological order', () => {
    const invalid = {
      ...minimalValidState,
      messages: [
        {
          id: '123e4567-e89b-12d3-a456-426614174003',
          role: 'user',
          content: 'Later',
          timestamp: '2026-04-12T10:00:05Z',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174004',
          role: 'user',
          content: 'Earlier',
          timestamp: '2026-04-12T10:00:00Z',
        },
      ],
    };
    const result = safeParseAgentState(invalid);
    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      expect(result.error.errors[0].message).toContain('ordered chronologically');
    }
  });

  test('createInitialState generates valid state with UUID threadId', () => {
    const state = createInitialState();
    expect(state.version).toBe('1.0');
    expect(state.threadId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(state.messages).toEqual([]);
    expect(state.routerState).toEqual({
      pivotSignals: [],
      requiresApproval: false,
      phase: 'hard-rule',
    });
  });

  test('createInitialState with custom threadId', () => {
    const state = createInitialState(validThreadId);
    expect(state.threadId).toBe(validThreadId);
  });
});

describe('MessageSchema', () => {
  test('validates valid message', () => {
    const msg = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      role: 'user' as const,
      content: 'Hello',
      timestamp: '2026-04-12T10:00:00Z',
    };
    expect(() => MessageSchema.parse(msg)).not.toThrow();
  });

  test('rejects invalid role', () => {
    const msg = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      role: 'invalid',
      content: 'Hello',
      timestamp: '2026-04-12T10:00:00Z',
    };
    expect(() => MessageSchema.parse(msg)).toThrow();
  });
});

describe('RouterStateSchema', () => {
  test('defaults empty object', () => {
    const parsed = RouterStateSchema.parse({});
    expect(parsed.pivotSignals).toEqual([]);
    expect(parsed.requiresApproval).toBe(false);
    expect(parsed.phase).toBe('hard-rule');
    expect(parsed.lastDecision).toBeUndefined();
  });

  test('accepts full router state', () => {
    const routerState = {
      pivotSignals: ['signal1'],
      requiresApproval: true,
      phase: 'llm-fallback' as const,
      lastDecision: {
        ruleId: 'rule-1',
        confidence: 0.8,
        timestamp: '2026-04-12T10:00:00Z',
      },
    };
    expect(() => RouterStateSchema.parse(routerState)).not.toThrow();
  });
});

describe('Schema Evolution & Migration', () => {
  test('migrateV1ToV2 returns object with version 2.0', () => {
    const v1State = createInitialState();
    const migrated = migrateV1ToV2(v1State);
    expect(migrated).toHaveProperty('version', '2.0');
    expect(migrated).toHaveProperty('metadata.migratedFromV1', true);
  });

  test('parseWithMigration accepts v1.0 state directly', () => {
    const v1State = createInitialState();
    const parsed = parseWithMigration(v1State);
    expect(parsed.version).toBe('1.0');
  });

  test('parseWithMigration handles missing version (assumes v1.0)', () => {
    const stateless = { threadId: '123e4567-e89b-12d3-a456-426614174000' };
    const parsed = parseWithMigration(stateless);
    expect(parsed.version).toBe('1.0');
    expect(parsed.threadId).toBe(stateless.threadId);
  });

  test('parseWithMigration throws on invalid data after migration', () => {
    const invalid = { version: '1.0', threadId: 'not-a-uuid' };
    expect(() => parseWithMigration(invalid)).toThrow();
  });
});

describe('Checkpoint Integration', () => {
  test('createCheckpoint returns serializable object', () => {
    const state = createInitialState();
    const checkpoint = createCheckpoint(state);
    expect(typeof checkpoint).toBe('object');
    expect(JSON.stringify(checkpoint)).toBeTruthy();
  });

  test('loadCheckpoint uses parseWithMigration', () => {
    const checkpoint = createInitialState();
    const loaded = loadCheckpoint(checkpoint);
    expect(loaded).toEqual(checkpoint);
  });

  test('roundtrip: createCheckpoint -> loadCheckpoint', () => {
    const original = createInitialState();
    const checkpoint = createCheckpoint(original);
    const loaded = loadCheckpoint(checkpoint);
    expect(loaded).toEqual(original);
  });
});