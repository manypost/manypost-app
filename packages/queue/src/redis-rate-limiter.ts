import Redis from 'ioredis';
import type { RateLimiter } from '@manypost/core';

/**
 * Janela fixa all-or-nothing em Lua (atômico) — SPEC_QUEUE §6.
 * Sem Redis disponível a publicação NÃO para: falha aberta com log (Redis é descartável — SPEC_INFRA §1).
 */
const WINDOW_SCRIPT = `
local n = #KEYS
for i = 1, n do
  local limit = tonumber(ARGV[2*i-1])
  local c = tonumber(redis.call('GET', KEYS[i]) or '0')
  if c >= limit then
    local ttl = redis.call('TTL', KEYS[i])
    if ttl < 1 then ttl = tonumber(ARGV[2*i]) end
    return {0, ttl}
  end
end
for i = 1, n do
  local window = tonumber(ARGV[2*i])
  local c = redis.call('INCR', KEYS[i])
  if c == 1 then redis.call('EXPIRE', KEYS[i], window) end
end
return {1, 0}
`;

/**
 * Semáforo de concorrência (maxConcurrent) via sorted set — SPEC_QUEUE §6.
 * Cada slot ocupado é um membro (token único) com score = momento da aquisição.
 * Antes de contar, expurga membros mais velhos que `stale_ms` (worker que caiu no meio
 * segurando o slot — reclama automaticamente). Se ainda há vaga, adiciona e renova o TTL
 * da chave inteira (higiene: some se ninguém publicar). Adquire só 1 slot por chamada.
 *   KEYS[1] = chave do semáforo   ARGV = now_ms, stale_ms, limit, token
 *   retorna 1 (adquiriu) ou 0 (cheio)
 */
const SEMAPHORE_SCRIPT = `
local now = tonumber(ARGV[1])
local stale = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local token = ARGV[4]
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - stale)
local count = redis.call('ZCARD', KEYS[1])
if count < limit then
  redis.call('ZADD', KEYS[1], now, token)
  redis.call('PEXPIRE', KEYS[1], stale)
  return 1
end
return 0
`;

export interface RedisRateLimiterOpts {
  /** TTL de um slot ocupado antes de ser reclamado (worker morto) — alinhado ao watchdog de zumbis (15 min) */
  slotStaleSec?: number;
}

export function makeRedisRateLimiter(
  redisUrl: string,
  opts: RedisRateLimiterOpts = {},
): RateLimiter & { close(): Promise<void> } {
  const slotStaleMs = (opts.slotStaleSec ?? 900) * 1000;
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', () => {}); // logado no acquire; evita crash por evento não tratado

  const ensure = async () => {
    if (redis.status === 'wait') await redis.connect();
  };

  return {
    async acquire(windows) {
      if (windows.length === 0) return { ok: true };
      try {
        await ensure();
        const res = (await redis.eval(
          WINDOW_SCRIPT,
          windows.length,
          ...windows.map((w) => w.key),
          ...windows.flatMap((w) => [String(w.limit), String(w.windowSec)]),
        )) as [number, number];
        return res[0] === 1 ? { ok: true } : { ok: false, retryAfterSec: Math.max(1, res[1]) };
      } catch (err) {
        console.log(
          JSON.stringify({ level: 'warn', msg: 'rate-limiter sem Redis — falha aberta', err: String(err) }),
        );
        return { ok: true };
      }
    },
    async acquireSlot(key, limit, token) {
      if (limit <= 0) return { ok: true };
      try {
        await ensure();
        const got = (await redis.eval(
          SEMAPHORE_SCRIPT,
          1,
          key,
          String(Date.now()),
          String(slotStaleMs),
          String(limit),
          token,
        )) as number;
        // sem retryAfter natural (o slot libera a qualquer momento): backoff curto com jitter
        return got === 1 ? { ok: true } : { ok: false, retryAfterSec: 2 + Math.floor(Math.random() * 4) };
      } catch (err) {
        console.log(
          JSON.stringify({ level: 'warn', msg: 'semáforo sem Redis — falha aberta', err: String(err) }),
        );
        return { ok: true };
      }
    },
    async releaseSlot(key, token) {
      try {
        await ensure();
        await redis.zrem(key, token);
      } catch {
        // slot expira sozinho por staleSec — perder o release nunca trava o provider
      }
    },
    async close() {
      await redis.quit().catch(() => {});
    },
  };
}
