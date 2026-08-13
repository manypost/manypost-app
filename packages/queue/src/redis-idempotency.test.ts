import { afterAll, describe, expect, test } from 'bun:test';
import { makeRedisIdempotencyStore } from './redis-idempotency';

/**
 * Contrato do store de idempotência (SPEC_API_MCP §3): claim atômico com replay/conflict/pending,
 * TTL expirando a reserva, release apagando SÓ reserva pendente — e, sem Redis, falha aberta
 * (perde-se a dedupe, nunca a corretude).
 */
const redisUrl = process.env.TEST_REDIS_URL;
const redisTest = redisUrl ? test : test.skip;

const semRedis = makeRedisIdempotencyStore('redis://127.0.0.1:1');
const comRedis = redisUrl ? makeRedisIdempotencyStore(redisUrl) : null;

afterAll(async () => {
  await semRedis.close();
  await comRedis?.close();
});

const chave = () => `test:idem:${crypto.randomUUID()}`;

describe('idempotência sem Redis — falha aberta', () => {
  test('claim concede (o handler roda; perde-se só a dedupe)', async () => {
    expect(await semRedis.claim(chave(), 'fp', 60)).toEqual({ outcome: 'claimed' });
  });

  test('store e release não lançam', async () => {
    const key = chave();
    await expect(semRedis.store(key, { status: 200, body: '{}' }, 60)).resolves.toBeUndefined();
    await expect(semRedis.release(key)).resolves.toBeUndefined();
  });
});

describe('idempotência com Redis real', () => {
  redisTest('primeira chamada reserva; repetição em voo responde pending', async () => {
    const key = chave();
    expect(await comRedis!.claim(key, 'fp-1', 60)).toEqual({ outcome: 'claimed' });
    expect(await comRedis!.claim(key, 'fp-1', 60)).toEqual({ outcome: 'pending' });
  });

  redisTest('mesmo corpo depois do store devolve REPLAY com a resposta guardada', async () => {
    const key = chave();
    await comRedis!.claim(key, 'fp-1', 60);
    await comRedis!.store(key, { status: 201, body: '{"id":"x"}' }, 60);

    expect(await comRedis!.claim(key, 'fp-1', 60)).toEqual({
      outcome: 'replay',
      response: { status: 201, body: '{"id":"x"}' },
    });
  });

  redisTest('corpo DIFERENTE com a mesma chave é conflito, nunca replay', async () => {
    const key = chave();
    await comRedis!.claim(key, 'fp-1', 60);
    expect(await comRedis!.claim(key, 'fp-2', 60)).toEqual({ outcome: 'conflict' });
  });

  redisTest('release apaga reserva pendente (a chave volta a ser reivindicável)', async () => {
    const key = chave();
    await comRedis!.claim(key, 'fp-1', 60);
    await comRedis!.release(key);
    expect(await comRedis!.claim(key, 'fp-1', 60)).toEqual({ outcome: 'claimed' });
  });

  redisTest('release NUNCA apaga resposta concluída — o replay sobrevive', async () => {
    const key = chave();
    await comRedis!.claim(key, 'fp-1', 60);
    await comRedis!.store(key, { status: 200, body: 'ok' }, 60);
    await comRedis!.release(key);

    expect(await comRedis!.claim(key, 'fp-1', 60)).toEqual({
      outcome: 'replay',
      response: { status: 200, body: 'ok' },
    });
  });

  redisTest('a reserva expira pelo TTL — chave esquecida não bloqueia para sempre', async () => {
    const key = chave();
    expect(await comRedis!.claim(key, 'fp-1', 1)).toEqual({ outcome: 'claimed' });
    await new Promise((r) => setTimeout(r, 1_100));
    expect(await comRedis!.claim(key, 'fp-1', 1)).toEqual({ outcome: 'claimed' });
  });
});
