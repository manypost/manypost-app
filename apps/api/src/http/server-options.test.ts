import { describe, expect, it } from 'bun:test';

describe('configuração do servidor SSE', () => {
  it('mantém a conexão ociosa por mais tempo que o intervalo de keepalive', async () => {
    const config = await import('./server-options').catch(() => undefined);

    expect(config?.SERVER_IDLE_TIMEOUT_SEC).toBeGreaterThan(
      (config?.SSE_KEEPALIVE_MS ?? Number.POSITIVE_INFINITY) / 1_000,
    );
  });
});
