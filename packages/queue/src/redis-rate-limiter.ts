import Redis from 'ioredis';
import type { RateLimiter } from '@manypost/core';

/**
 * Janela fixa all-or-nothing em Lua (atômico) — SPEC_QUEUE §6.
 * Sem Redis disponível a publicação NÃO para: falha aberta com log (Redis é descartável — SPEC_INFRA §1).
 */
const SCRIPT = `
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

export function makeRedisRateLimiter(redisUrl: string): RateLimiter & { close(): Promise<void> } {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', () => {}); // logado no acquire; evita crash por evento não tratado

  return {
    async acquire(windows) {
      if (windows.length === 0) return { ok: true };
      try {
        if (redis.status === 'wait') await redis.connect();
        const res = (await redis.eval(
          SCRIPT,
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
    async close() {
      await redis.quit().catch(() => {});
    },
  };
}
