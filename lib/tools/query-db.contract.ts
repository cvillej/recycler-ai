import { z } from 'zod';
import { Pool } from 'pg';
import type { ToolContract } from './types';
import { parseEnv } from '../utils/env'; // Future helper

const pool = new Pool({ connectionString: parseEnv('POSTGRES_URL') });

export const queryDbContract: ToolContract<typeof inputSchema, typeof outputSchema> = {
  name: 'queryDb',
  version: 'v1',
  description: 'Execute a safe Postgres query (table scan with filters, no DML).',
  inputSchema: inputSchema,
  outputSchema: outputSchema,
  async execute(input) {
    const client = await pool.connect();
    try {
      // Placeholder query (no real SQL yet)
      const result = await client.query('SELECT 1 as test');
      return { rows: result.rows };
    } finally {
      client.release();
    }
  },
  testVectors: [
    {
      validInput: { table: 'users', filters: { id: 1 } },
      validOutput: { rows: [{ test: 1 }] },
    },
  ],
};

const inputSchema = z.object({
  table: z.string(),
  filters: z.record(z.any()).optional(),
});

const outputSchema = z.object({
  rows: z.array(z.record(z.any())),
});
