import Redis from 'ioredis';
import type { RealtimeEvent, RealtimePublisher, RealtimeSubscriber } from '@manypost/core';

const channelOf = (orgId: string) => `mp:rt:${orgId}`;

/**
 * Bus realtime sobre Redis pub/sub (SSE /v1/events). Melhor esforço, coerente com o
 * rate-limiter: sem Redis o publish falha aberto com log — a UI tem polling de fallback.
 * O subscribe usa conexão dedicada (exigência do protocolo Redis para modo subscriber).
 */
export function makeRedisRealtimeBus(
  redisUrl: string,
): RealtimePublisher & RealtimeSubscriber & { close(): Promise<void> } {
  const pub = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  pub.on('error', () => {}); // logado no publish; evita crash por evento não tratado

  let sub: Redis | null = null;
  const handlers = new Map<string, Set<(e: RealtimeEvent) => void>>();

  const ensureSubscriber = async () => {
    if (!sub) {
      sub = new Redis(redisUrl, { lazyConnect: true });
      sub.on('error', () => {});
      sub.on('message', (channel: string, message: string) => {
        const set = handlers.get(channel);
        if (!set) return;
        try {
          const event = JSON.parse(message) as RealtimeEvent;
          for (const handler of set) handler(event);
        } catch {
          // payload corrompido: descarta — o polling cobre
        }
      });
      await sub.connect();
    }
    return sub;
  };

  return {
    async publish(orgId, e) {
      try {
        if (pub.status === 'wait') await pub.connect();
        await pub.publish(channelOf(orgId), JSON.stringify(e));
      } catch (err) {
        console.log(
          JSON.stringify({ level: 'warn', msg: 'realtime sem Redis — evento descartado', err: String(err) }),
        );
      }
    },

    async subscribe(orgId, onEvent) {
      const s = await ensureSubscriber();
      const channel = channelOf(orgId);
      let set = handlers.get(channel);
      if (!set) {
        set = new Set();
        handlers.set(channel, set);
        await s.subscribe(channel);
      }
      set.add(onEvent);
      return async () => {
        set.delete(onEvent);
        if (set.size === 0) {
          handlers.delete(channel);
          await s.unsubscribe(channel).catch(() => {});
        }
      };
    },

    async close() {
      await pub.quit().catch(() => {});
      await sub?.quit().catch(() => {});
    },
  };
}
