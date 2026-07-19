import PgBoss from 'pg-boss';
import postgres from 'postgres';
import type {
  ChannelProviderRegistry,
  ChannelRepository,
  CryptoService,
  IdempotencyStore,
  JobScheduler,
  MetricsSink,
  PublishingRepository,
  RateLimiter,
  WebhookRepository,
} from '@manypost/core';
import {
  PUBLISH_QUEUE,
  RECOVER_QUEUE,
  THREAD_QUEUE,
  WEBHOOK_QUEUE,
  makeContinueThread,
  makeDeliverWebhook,
  makeEmitEvent,
  makePublishPublication,
  makeRecoverDue,
} from '@manypost/core';
import { makeRedisIdempotencyStore } from './redis-idempotency';
import { makeRedisRateLimiter } from './redis-rate-limiter';
import { makeRedisRealtimeBus } from './redis-realtime-bus';

const log = (level: string, msg: string, data?: object) =>
  console.log(JSON.stringify({ level, msg, module: 'queue', ...data }));

export interface PublishingRuntimeOpts {
  databaseUrl: string;
  redisUrl?: string;
  publishing: PublishingRepository;
  channels: ChannelRepository;
  webhooks: WebhookRepository;
  registry: ChannelProviderRegistry;
  crypto: CryptoService;
  retryBaseSec: number;
  allowPrivateWebhookUrls?: boolean;
  /** secrets de app por provider (env → ctx.secrets do worker) */
  providerSecrets?: Record<string, Record<string, string>>;
  /** coletor de métricas (SPEC_INFRA §4) — publish/recover incrementam contadores */
  metrics?: MetricsSink;
}

export interface PublishingRuntime {
  scheduler: JobScheduler;
  /** compartilhado com a API (ex.: rate-limit da superfície pública de aprovação) */
  rateLimiter?: RateLimiter;
  /** idempotência de POSTs da API pública (SPEC_API_MCP §3) — sem Redis fica indefinido (falha aberta) */
  idempotency?: IdempotencyStore;
  /** bus pub/sub p/ SSE — worker publica, API assina (mesmo objeto em MODE=all) */
  realtime?: ReturnType<typeof makeRedisRealtimeBus>;
  events: ReturnType<typeof makeEmitEvent>;
  publish: (publicationId: string, v?: number) => Promise<void>;
  recover: () => Promise<{ due: number; stuck: number }>;
  /** profundidade das filas (jobs created/retry) p/ o gauge do /metrics — SPEC_INFRA §4 */
  queueDepths(): Promise<Record<string, number>>;
  startWorker(): Promise<void>;
  stop(): Promise<void>;
}

export async function createPublishingRuntime(
  opts: PublishingRuntimeOpts,
): Promise<PublishingRuntime> {
  const boss = new PgBoss({ connectionString: opts.databaseUrl });
  boss.on('error', (err) => log('error', 'pg-boss', { err: String(err) }));
  await boss.start();
  for (const q of [PUBLISH_QUEUE, THREAD_QUEUE, RECOVER_QUEUE, WEBHOOK_QUEUE]) {
    await boss.createQueue(q).catch(() => {}); // idempotente entre versões
  }
  // conexão dedicada para operações fora da API do pg-boss (cancel por singletonKey)
  const sqlc = postgres(opts.databaseUrl, { max: 1, onnotice: () => {} });

  const scheduler: JobScheduler = {
    async enqueue(queue, payload, o) {
      const id = await boss.send(queue, payload, {
        ...(o?.startAfter ? { startAfter: o.startAfter } : {}),
        ...(o?.singletonKey ? { singletonKey: o.singletonKey } : {}),
        retryLimit: o?.retryLimit ?? 0, // retry de negócio é da máquina de estados
      });
      return id ?? 'deduped';
    },
    async cancelBySingletonKey(queue, singletonKey) {
      // higiene best-effort: a corretude vem do fencing estado+versão no handler
      await sqlc`
        UPDATE pgboss.job SET state = 'cancelled'
        WHERE name = ${queue} AND singleton_key = ${singletonKey}
          AND state IN ('created', 'retry')`.catch((err) =>
        log('warn', 'cancel de job falhou (inofensivo — fencing cobre)', { err: String(err) }),
      );
    },
    async schedule(queue, cron, payload) {
      await boss.schedule(queue, cron, (payload ?? {}) as object, {});
    },
  };

  const rateLimiter = opts.redisUrl ? makeRedisRateLimiter(opts.redisUrl) : undefined;
  const idempotency = opts.redisUrl ? makeRedisIdempotencyStore(opts.redisUrl) : undefined;
  const realtime = opts.redisUrl ? makeRedisRealtimeBus(opts.redisUrl) : undefined;
  const events = makeEmitEvent({
    webhooks: opts.webhooks,
    scheduler,
    ...(realtime ? { realtime } : {}),
    log,
  });
  const publish = makePublishPublication({
    publishing: opts.publishing,
    channels: opts.channels,
    registry: opts.registry,
    crypto: opts.crypto,
    scheduler,
    retryBaseSec: opts.retryBaseSec,
    ...(rateLimiter ? { rateLimiter } : {}),
    ...(opts.metrics ? { metrics: opts.metrics } : {}),
    ...(opts.providerSecrets ? { secrets: opts.providerSecrets } : {}),
    events,
    log,
  });
  const continueThread = makeContinueThread({
    publishing: opts.publishing,
    channels: opts.channels,
    registry: opts.registry,
    crypto: opts.crypto,
    scheduler,
    retryBaseSec: opts.retryBaseSec,
    ...(rateLimiter ? { rateLimiter } : {}),
    ...(opts.metrics ? { metrics: opts.metrics } : {}),
    ...(opts.providerSecrets ? { secrets: opts.providerSecrets } : {}),
    events,
    log,
  });
  const recover = makeRecoverDue({ publishing: opts.publishing, scheduler, log });
  const deliver = makeDeliverWebhook({
    webhooks: opts.webhooks,
    crypto: opts.crypto,
    scheduler,
    ...(opts.allowPrivateWebhookUrls ? { allowPrivateUrls: true } : {}),
    log,
  });

  return {
    scheduler,
    ...(rateLimiter ? { rateLimiter } : {}),
    ...(idempotency ? { idempotency } : {}),
    ...(realtime ? { realtime } : {}),
    events,
    publish,
    recover,
    async queueDepths() {
      try {
        const rows = await sqlc<{ name: string; count: string }[]>`
          SELECT name, count(*)::text AS count FROM pgboss.job
          WHERE state IN ('created', 'retry') GROUP BY name`;
        const out: Record<string, number> = {
          [PUBLISH_QUEUE]: 0,
          [THREAD_QUEUE]: 0,
          [RECOVER_QUEUE]: 0,
          [WEBHOOK_QUEUE]: 0,
        };
        for (const r of rows) out[r.name] = Number(r.count);
        return out;
      } catch (err) {
        log('warn', 'queueDepths falhou (métrica inofensiva)', { err: String(err) });
        return {};
      }
    },
    async startWorker() {
      await boss.work<{ publicationId: string; v?: number }>(PUBLISH_QUEUE, async (jobs) => {
        for (const job of jobs) {
          try {
            await publish(job.data.publicationId, job.data.v);
          } catch (err) {
            log('error', 'publish handler falhou', {
              publicationId: job.data.publicationId,
              err: String(err),
            });
          }
        }
      });
      await boss.work<{ publicationId: string; v: number; afterIndex: number }>(
        THREAD_QUEUE,
        async (jobs) => {
          for (const job of jobs) {
            try {
              await continueThread(job.data.publicationId, job.data.v, job.data.afterIndex);
            } catch (err) {
              log('error', 'thread continuation falhou', {
                publicationId: job.data.publicationId,
                err: String(err),
              });
            }
          }
        },
      );
      await boss.work<{ deliveryId: string }>(WEBHOOK_QUEUE, async (jobs) => {
        for (const job of jobs) {
          try {
            await deliver(job.data.deliveryId);
          } catch (err) {
            log('error', 'webhook delivery falhou', { deliveryId: job.data.deliveryId, err: String(err) });
          }
        }
      });
      await boss.work(RECOVER_QUEUE, async () => {
        const out = await recover();
        opts.metrics?.onRecovered('due', out.due);
        opts.metrics?.onRecovered('stuck', out.stuck);
        if (out.due || out.stuck) log('warn', 'recover-scan agiu', out);
      });
      await boss.schedule(RECOVER_QUEUE, '* * * * *', {}, {}); // barato: índices parciais
      log('info', 'worker ativo', {
        queues: [PUBLISH_QUEUE, THREAD_QUEUE, WEBHOOK_QUEUE, RECOVER_QUEUE],
      });
    },
    async stop() {
      await boss.stop({ graceful: true });
      await rateLimiter?.close();
      await idempotency?.close();
      await realtime?.close();
      await sqlc.end();
    },
  };
}
