import { describe, expect, it } from 'bun:test';
import { loadEnv, machineEndpoints, machineHosts } from './env';

/** env mínima válida (os demais campos têm default) */
const base = {
  PUBLIC_URL: 'https://manypost.com.br',
  DATABASE_URL: 'postgresql://mp:mp@localhost:5432/mp',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'segredo-de-teste-com-pelo-menos-32-chars',
  ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('superfícies de máquina (SPEC_API_MCP §3/§5)', () => {
  it('sem host dedicado, cai nos caminhos da própria origem', () => {
    const env = loadEnv(base);
    expect(machineHosts(env)).toEqual({});
    expect(machineEndpoints(env)).toEqual({
      restBaseUrl: 'https://manypost.com.br/public/v1',
      mcpUrl: 'https://manypost.com.br/mcp',
    });
  });

  it('com api. dedicado, REST vai para /v1 e o MCP acompanha o mesmo host', () => {
    const env = loadEnv({ ...base, API_PUBLIC_URL: 'https://api.manypost.com.br/' });
    expect(machineHosts(env)).toEqual({ api: 'api.manypost.com.br' });
    expect(machineEndpoints(env)).toEqual({
      restBaseUrl: 'https://api.manypost.com.br/v1', // a barra final não vaza p/ a URL
      mcpUrl: 'https://api.manypost.com.br/mcp',
    });
  });

  it('com mcp. dedicado, o MCP é a RAIZ dele (é a URL que o usuário cola no cliente)', () => {
    const env = loadEnv({
      ...base,
      API_PUBLIC_URL: 'https://api.manypost.com.br',
      MCP_PUBLIC_URL: 'https://mcp.manypost.com.br',
    });
    expect(machineHosts(env)).toEqual({ api: 'api.manypost.com.br', mcp: 'mcp.manypost.com.br' });
    expect(machineEndpoints(env).mcpUrl).toBe('https://mcp.manypost.com.br');
  });

  it('mantém a porta no host (é assim que dev/e2e separam superfícies num processo só)', () => {
    const env = loadEnv({
      ...base,
      PUBLIC_URL: 'http://localhost:3988',
      API_PUBLIC_URL: 'http://127.0.0.1:3988',
    });
    expect(machineHosts(env).api).toBe('127.0.0.1:3988');
  });

  it('recusa host de máquina igual ao do app (esconderia a interface web)', () => {
    expect(() => loadEnv({ ...base, API_PUBLIC_URL: 'https://manypost.com.br' })).toThrow(
      /API_PUBLIC_URL/,
    );
    expect(() => loadEnv({ ...base, MCP_PUBLIC_URL: 'https://manypost.com.br/mcp' })).toThrow(
      /MCP_PUBLIC_URL/,
    );
  });
});
