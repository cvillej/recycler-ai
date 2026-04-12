import { describe, expect, test, jest } from '@jest/globals';
import { registerTool, getToolExecutor, listRegisteredTools } from './registry';
import { queryDbContract } from './query-db.contract';

describe('Tool Layer', () => {
  test('registers and retrieves queryDb tool', () => {
    registerTool(queryDbContract);
    expect(listRegisteredTools()).toContain('queryDb@v1');
    const executor = getToolExecutor('queryDb');
    expect(executor).toBeDefined();
  });

  test('queryDb contract validation', () => {
    const input = queryDbContract.inputSchema.parse({ table: 'users' });
    expect(input.table).toBe('users');
  });
});
