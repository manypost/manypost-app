import { describe, expect, it } from 'bun:test';
import {
  clerkConfig,
  loadEnv,
  machineEndpoints,
  machineHosts,
  providerEnvVarNames,
  providerSecretsFromEnv,
} from './env';

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

describe('Clerk para autenticação humana', () => {
  it('exige publishable key e secret key como um par sem expor valores', () => {
    expect(() =>
      loadEnv({ ...base, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example' }),
    ).toThrow(/CLERK_SECRET_KEY/);
    expect(() => loadEnv({ ...base, CLERK_SECRET_KEY: 'sk_test_example' })).toThrow(
      /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/,
    );
  });

  it('autoriza somente a origem humana do PUBLIC_URL', () => {
    const config = clerkConfig(
      loadEnv({
        ...base,
        PUBLIC_URL: 'https://app.manypost.com.br/',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
        CLERK_SECRET_KEY: 'sk_test_example',
      }),
    );
    expect(config).toEqual({
      enabled: true,
      publishableKey: 'pk_test_example',
      secretKey: 'sk_test_example',
      jwtKey: undefined,
      authorizedParties: ['https://app.manypost.com.br'],
    });
  });

  it('permanece desabilitado quando nenhuma chave foi configurada', () => {
    expect(clerkConfig(loadEnv(base))).toEqual({
      enabled: false,
      authorizedParties: ['https://manypost.com.br'],
    });
  });
});

describe('secrets de provider ← env (SPEC_INTEGRATIONS §2)', () => {
  it('injeta só o que está preenchido, por provider', () => {
    const env = loadEnv({
      ...base,
      THREADS_APP_ID: 'app',
      THREADS_APP_SECRET: 'sec',
      INSTAGRAM_APP_ID: 'ig',
      INSTAGRAM_APP_SECRET: 'igsec',
      FACEBOOK_APP_ID: 'fb',
      FACEBOOK_APP_SECRET: 'fbsec',
    });
    const secrets = providerSecretsFromEnv(env);
    expect(secrets.threads).toEqual({ appId: 'app', appSecret: 'sec' });
    expect(secrets['instagram-standalone']).toEqual({ appId: 'ig', appSecret: 'igsec' });
    expect(secrets.facebook).toEqual({ appId: 'fb', appSecret: 'fbsec' });
    // sem env, o provider fica com o objeto vazio (e some do catálogo por requiredSecrets)
    expect(secrets.tiktok).toEqual({});
    expect(secrets.discord).toEqual({});
  });

  it('diz qual VARIÁVEL falta — é o que a UI mostra em vez de esconder a rede', () => {
    expect(providerEnvVarNames('threads', ['appId', 'appSecret'])).toEqual([
      'THREADS_APP_ID',
      'THREADS_APP_SECRET',
    ]);
    expect(providerEnvVarNames('tiktok', ['clientKey'])).toEqual(['TIKTOK_CLIENT_KEY']);
    expect(providerEnvVarNames('instagram-standalone', ['appId', 'appSecret'])).toEqual([
      'INSTAGRAM_APP_ID',
      'INSTAGRAM_APP_SECRET',
    ]);
    expect(providerEnvVarNames('facebook', ['appId', 'appSecret'])).toEqual([
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
    ]);
    // provider/secret sem mapa não inventa nome (fica de fora da dica)
    expect(providerEnvVarNames('bluesky', ['handle'])).toEqual([]);
    expect(providerEnvVarNames('x', ['clientId', 'inexistente'])).toEqual(['X_CLIENT_ID']);
  });
});
