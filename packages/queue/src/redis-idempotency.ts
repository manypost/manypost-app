import Redis from 'ioredis';
import type { IdempotencyClaim, IdempotencyStore, StoredResponse } from '@manypost/core';

/**
 * Idempotência de POSTs de mutação (SPEC_API_MCP §3) via um hash Redis por chave.
 * Campos: `fp` (fingerprint do corpo), `state` (pending|done), `status`, `body`.
 *
 * `claim` é atômico (Lua): 1ª chamada reserva (pending); repetição com o MESMO corpo devolve
 * a resposta guardada (replay) ou `pending` (ainda em voo); corpo diferente = `conflict`.
 * Sem Redis: falha aberta — `claim` devolve `claimed` (o handler roda), `store`/`release` viram
 * no-op. Perde-se só a dedupe, nunca a corretude (postura "Redis é descartável", SPEC_INFRA §1).
 */
const CLAIM_SCRIPT = `
local fp = redis.call('HGET', KEYS[1], 'fp')
if not fp then
  redis.call('HSET', KEYS[1], 'fp', ARGV[1], 'state', 'pending')
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return {'claimed'}
end
if fp ~= ARGV[1] then return {'conflict'} end
local state = redis.call('HGET', KEYS[1], 'state')
if state == 'done' then
  return {'replay', redis.call('HGET', KEYS[1], 'status'), redis.call('HGET', KEYS[1], 'body')}
end
return {'pending'}
`;

// só apaga uma reserva ainda pendente (nunca uma resposta já concluída)
const RELEASE_SCRIPT = `
if redis.call('HGET', KEYS[1], 'state') == 'pending' then redis.call('DEL', KEYS[1]) end
`;

export function makeRedisIdempotencyStore(
  redisUrl: string,
): IdempotencyStore & { close(): Promise<void> } {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', () => {}); // logado nos métodos; evita crash por evento não tratado

  const ensure = async () => {
    if (redis.status === 'wait') await redis.connect();
  };

  return {
    async claim(key, fingerprint, ttlSec): Promise<IdempotencyClaim> {
      try {
        await ensure();
        const res = (await redis.eval(
          CLAIM_SCRIPT,
          1,
          key,
          fingerprint,
          String(ttlSec),
        )) as [string, string?, string?];
        if (res[0] === 'replay') {
          return {
            outcome: 'replay',
            response: { status: Number(res[1]), body: res[2] ?? '' },
          };
        }
        if (res[0] === 'conflict') return { outcome: 'conflict' };
        if (res[0] === 'pending') return { outcome: 'pending' };
        return { outcome: 'claimed' };
      } catch (err) {
        console.log(
          JSON.stringify({ level: 'warn', msg: 'idempotency sem Redis — falha aberta', err: String(err) }),
        );
        return { outcome: 'claimed' };
      }
    },
    async store(key, response: StoredResponse, ttlSec) {
      try {
        await ensure();
        await redis
          .multi()
          .hset(key, 'state', 'done', 'status', String(response.status), 'body', response.body)
          .expire(key, ttlSec)
          .exec();
      } catch {
        // reserva expira sozinha por TTL; perder o store só custa a dedupe do replay
      }
    },
    async release(key) {
      try {
        await ensure();
        await redis.eval(RELEASE_SCRIPT, 1, key);
      } catch {
        // idem: a reserva pending expira por TTL de qualquer forma
      }
    },
    async close() {
      await redis.quit().catch(() => {});
    },
  };
}
