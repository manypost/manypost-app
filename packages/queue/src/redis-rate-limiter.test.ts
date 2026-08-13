import { afterAll, describe, expect, test } from 'bun:test';
import { makeRedisRateLimiter } from './redis-rate-limiter';

/**
 * As duas metades do contrato do rate limiter (SPEC_QUEUE §6):
 *  1. SEM Redis ele FALHA ABERTO — Redis é descartável (SPEC_INFRA §1) e a publicação não para;
 *  2. COM Redis ele nega no teto, o release devolve o slot e slot de worker morto é reclamado.
 * A metade real é gated por TEST_REDIS_URL, como as suítes de Postgres fazem com o banco.
 */
const redisUrl = process.env.TEST_REDIS_URL;
const redisTest = redisUrl ? test : test.skip;

// porta 1: conexão recusada na hora — o caminho "sem Redis" sem esperar timeout
const semRedis = makeRedisRateLimiter('redis://127.0.0.1:1');
const comRedis = redisUrl ? makeRedisRateLimiter(redisUrl, { slotStaleSec: 1 }) : null;

afterAll(async () => {
  await semRedis.close();
  await comRedis?.close();
});

const chave = (rotulo: string) => `test:rl:${rotulo}:${crypto.randomUUID()}`;

describe('rate limiter sem Redis — falha aberta', () => {
  test('janela indisponível concede em vez de travar a publicação', async () => {
    const verdict = await semRedis.acquire([{ key: chave('janela'), limit: 1, windowSec: 60 }]);
    expect(verdict).toEqual({ ok: true });
  });

  test('semáforo indisponível concede em vez de travar a publicação', async () => {
    const verdict = await semRedis.acquireSlot!(chave('sem'), 1, 'token-1');
    expect(verdict).toEqual({ ok: true });
  });

  test('release sem Redis não lança (o slot expiraria sozinho)', async () => {
    await expect(semRedis.releaseSlot!(chave('rel'), 'token-1')).resolves.toBeUndefined();
  });

  test('sem janelas para adquirir, nem tenta conectar', async () => {
    expect(await semRedis.acquire([])).toEqual({ ok: true });
  });
});

describe('rate limiter com Redis real', () => {
  redisTest('a janela nega no teto e informa quando tentar de novo', async () => {
    const key = chave('janela');
    const janela = [{ key, limit: 2, windowSec: 60 }];
    expect(await comRedis!.acquire(janela)).toEqual({ ok: true });
    expect(await comRedis!.acquire(janela)).toEqual({ ok: true });

    const negado = await comRedis!.acquire(janela);
    expect(negado.ok).toBe(false);
    if (!negado.ok) expect(negado.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  redisTest('janelas são all-or-nothing: negar uma não consome a outra', async () => {
    const apertada = chave('apertada');
    const larga = chave('larga');
    expect(
      await comRedis!.acquire([{ key: apertada, limit: 1, windowSec: 60 }]),
    ).toEqual({ ok: true });

    // apertada está no teto: o pedido conjunto é negado e a larga NÃO incrementa
    const negado = await comRedis!.acquire([
      { key: apertada, limit: 1, windowSec: 60 },
      { key: larga, limit: 1, windowSec: 60 },
    ]);
    expect(negado.ok).toBe(false);

    // prova de que a larga não foi consumida no pedido negado
    expect(await comRedis!.acquire([{ key: larga, limit: 1, windowSec: 60 }])).toEqual({ ok: true });
  });

  redisTest('o semáforo nega no teto e o release devolve o slot exatamente', async () => {
    const key = chave('sem');
    expect(await comRedis!.acquireSlot!(key, 1, 'token-a')).toEqual({ ok: true });

    const negado = await comRedis!.acquireSlot!(key, 1, 'token-b');
    expect(negado.ok).toBe(false);

    await comRedis!.releaseSlot!(key, 'token-a');
    expect(await comRedis!.acquireSlot!(key, 1, 'token-c')).toEqual({ ok: true });
  });

  redisTest('slot de worker morto é reclamado depois de slotStaleSec', async () => {
    const key = chave('stale');
    expect(await comRedis!.acquireSlot!(key, 1, 'morto')).toEqual({ ok: true });
    // o dono morre sem release; com slotStaleSec=1 o slot é expurgado na próxima aquisição
    await new Promise((r) => setTimeout(r, 1_100));
    expect(await comRedis!.acquireSlot!(key, 1, 'vivo')).toEqual({ ok: true });
  });

  redisTest('limite <= 0 significa "sem semáforo" e concede direto', async () => {
    expect(await comRedis!.acquireSlot!(chave('zero'), 0, 't')).toEqual({ ok: true });
  });
});
