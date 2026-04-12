import { z } from 'zod';

// UUID generation that works in both Node.js and browser environments
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for Node.js < 15 or test environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// --- Message Schema ---
export const MessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// --- Router State Schema ---
export const RouterStateSchema = z.object({
  /**
   * Signals that may cause a pivot in routing logic.
   * Example: user expresses uncertainty, changes topic, asks for clarification.
   */
  pivotSignals: z.array(z.string()).default([]),

  /**
   * Whether the current state requires human approval before proceeding.
   * Used by deterministic hard rules in the Hybrid Router.
   */
  requiresApproval: z.boolean().default(false),

  /**
   * Current routing phase: 'hard-rule', 'state-based', 'llm-fallback'
   */
  phase: z.enum(['hard-rule', 'state-based', 'llm-fallback']).default('hard-rule'),

  /**
   * Last routing decision metadata.
   */
  lastDecision: z.object({
    ruleId: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    timestamp: z.string().datetime().optional(),
  }).optional(),
});

export type RouterState = z.infer<typeof RouterStateSchema>;

// --- LastError Schema ---
export const LastErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  timestamp: z.string().datetime(),
  stack: z.string().optional(),
});

export type LastError = z.infer<typeof LastErrorSchema>;

// --- AgentState Schema v1.0 ---
export const AgentStateSchema = z.object({
  /**
   * Schema version literal. Used for migration detection.
   */
  version: z.literal('1.0'),

  /**
   * Unique identifier for this conversation thread.
   */
  threadId: z.string().uuid(),

  /**
   * Ordered list of messages in the conversation.
   */
  messages: z.array(MessageSchema).default([]),

  /**
   * Contextual data that persists across turns but is not part of the message history.
   * Examples: user preferences, extracted entities, conversation summary.
   */
  context: z.record(z.unknown()).default({ toolResults: z.record(z.unknown()).default({}) } as any),

  /**
   * Hybrid Router internal state.
   */
  routerState: RouterStateSchema.default({}),

  /**
   * Arbitrary metadata for extensibility.
   */
  metadata: z.record(z.unknown()).default({}),

  /**
   * Last error encountered, if any.
   */
  lastError: LastErrorSchema.optional(),
})
.refine(
  (state) => {
    // Ensure messages are ordered by timestamp (optional invariant)
    const timestamps = state.messages.map(m => new Date(m.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < timestamps[i - 1]) return false;
    }
    return true;
  },
  { message: 'Messages must be ordered chronologically' }
);

export type AgentState = z.infer<typeof AgentStateSchema>;

// --- Factory for initial state ---
export function createInitialState(threadId?: string): AgentState {
  return {
    version: '1.0',
    threadId: threadId || generateUUID(),
    messages: [],
    context: {},
    routerState: {
      pivotSignals: [],
      requiresApproval: false,
      phase: 'hard-rule',
    },
    metadata: {},
  };
}

// --- LangGraph Channel Reducers ---
// messages, context, routerState, metadata, lastError
export const messagesReducer = (messages: Message[], add: Message[] | Message): Message[] => {
  const newMessages = Array.isArray(add) ? add : [add];
  const allMessages = [...messages, ...newMessages];
  // Sort by timestamp (optional invariant)
  allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return allMessages;
};

export const contextReducer = (context: Record<string, unknown>, update: Record<string, unknown>): Record<string, unknown> => ({
  ...context,
  ...update,
});

export const routerStateReducer = (routerState: RouterState, update: Partial<RouterState>): RouterState => ({
  ...routerState,
  ...update,
});

export const metadataReducer = (metadata: Record<string, unknown>, update: Record<string, unknown>): Record<string, unknown> => ({
  ...metadata,
  ...update,
});

export const lastErrorReducer = (prev: LastError | undefined, update: LastError | undefined): LastError | undefined => update || prev;

// --- Validation helpers ---
export function parseAgentState(input: unknown): AgentState {
  return AgentStateSchema.parse(input);
}

export function safeParseAgentState(input: unknown): { success: boolean; data?: AgentState; error?: z.ZodError } {
  return AgentStateSchema.safeParse(input);
}

// --- Schema Evolution & Migration ---
/**
 * Migration from v1.0 to a hypothetical v2.0.
 * This is a placeholder showing the pattern; actual v2 schema would be defined separately.
 *
 * For detailed schema evolution patterns, see:
 * - `docs/Agent-State.md`
 *
 * This migration pattern ensures backward compatibility when loading LangGraph checkpoints
 * from previous versions of the system.
 */
export function migrateV1ToV2(v1State: AgentState): unknown {
  // In a real migration, we would transform v1 fields to v2 fields.
  // For now, we keep the same structure but bump version.
  return {
    ...v1State,
    version: '2.0' as const,
    // Example: add a new field with default
    metadata: {
      ...v1State.metadata,
      migratedFromV1: true,
    },
  };
}

/**
 * Parses raw input, applying any necessary migrations based on version.
 * This is the recommended entry point for loading checkpoints from storage.
 *
 * Used by LangGraph when restoring checkpoints and by the Hybrid Router when
 * reading persisted state.
 *
 * @param raw - Raw JSON (e.g., from LangGraph checkpoint, localStorage, DB)
 * @returns Validated AgentState (latest version)
 * @throws {z.ZodError} if migration fails or final validation fails
 *
 * @see `docs/Agent-State.md`
 */
export function parseWithMigration(raw: unknown): AgentState {
  // First, parse into a minimal shape to detect version
  const versionSchema = z.object({ version: z.string() }).passthrough();
  const parsed = versionSchema.safeParse(raw);
  if (!parsed.success) {
    // No version field; assume v1.0 and add version
    const withVersion = { ...(raw as Record<string, unknown>), version: '1.0' };
    return AgentStateSchema.parse(withVersion);
  }

  const { version } = parsed.data;
  let current = parsed.data;

  // Apply migrations sequentially based on version
  if (version === '1.0') {
    // Already v1.0, no migration needed
    return AgentStateSchema.parse(current);
  }

  // If we had more versions, we'd chain migrations:
  // if (version === '1.0') current = migrateV1ToV2(current);
  // if (version === '2.0') current = migrateV2ToV3(current);
  // ...

  // After migrations, validate with latest schema
  return AgentStateSchema.parse(current);
}

/**
 * Creates a checkpoint‑compatible snapshot of the state.
 * Used by LangGraph's checkpointing system.
 *
 * The snapshot is a plain JSON object that can be stored in any
 * LangGraph‑compatible storage (memory, file, database).
 *
 * @param state - Current AgentState
 * @returns JSON‑serializable snapshot
 *
 * @see `new-docs/04 - Permanent/Architecture/Execution Engine.md`
 */
export function createCheckpoint(state: AgentState): unknown {
  // LangGraph expects plain JSON; Zod's .parse() already strips extra fields.
  return state;
}

/**
 * Loads a checkpoint, applying migrations if needed.
 *
 * This is the counterpart to `createCheckpoint`. It ensures that checkpoints
 * saved with older schema versions can still be loaded after schema evolution.
 *
 * @param checkpoint - JSON from LangGraph storage
 * @returns Validated AgentState
 *
 * @see `docs/Agent-State.md`
 */
export function loadCheckpoint(checkpoint: unknown): AgentState {
  return parseWithMigration(checkpoint);
}
