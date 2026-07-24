import { describe, expect, test } from 'bun:test';
import { hasMcpReadScope, hasMcpWriteScope } from './mcp-scopes';

describe('mcp scope implication', () => {
  test('legacy mcp implies read and write', () => {
    expect(hasMcpReadScope(['mcp'])).toBe(true);
    expect(hasMcpWriteScope(['mcp'])).toBe(true);
  });

  test('mcp:read alone does not imply write', () => {
    expect(hasMcpReadScope(['mcp:read'])).toBe(true);
    expect(hasMcpWriteScope(['mcp:read'])).toBe(false);
  });

  test('mcp:write alone does not imply read', () => {
    expect(hasMcpReadScope(['mcp:write'])).toBe(false);
    expect(hasMcpWriteScope(['mcp:write'])).toBe(true);
  });

  test('both fine scopes together', () => {
    expect(hasMcpReadScope(['mcp:read', 'mcp:write'])).toBe(true);
    expect(hasMcpWriteScope(['mcp:read', 'mcp:write'])).toBe(true);
  });
});
