/**
 * Implicação de escopos MCP: API key com `mcp` legado libera leitura e escrita;
 * grants OAuth usam `mcp:read` / `mcp:write` finos.
 */
export function hasMcpReadScope(scopes: readonly string[]): boolean {
  return scopes.includes('mcp') || scopes.includes('mcp:read');
}

export function hasMcpWriteScope(scopes: readonly string[]): boolean {
  return scopes.includes('mcp') || scopes.includes('mcp:write');
}
