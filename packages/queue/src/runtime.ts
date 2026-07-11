import PgBoss from 'pg-boss';
import type {
  ChannelProviderRegistry,
  ChannelRepository,
  CryptoService,
  JobScheduler,
  PublishingRepository,
} from '@manypost/core';
import {
  PUBLISH_QUEUE,
  RECOVER_QUEUE,
  makePublishPublication,
  makeRecoverDue,
} from '@manypost/core';

const log = (level: string, msg: string, data?: object) =>
  console.log(JSON.stringify({ level, msg, module: 'queue', ...data }));

export interface PublishingRuntimeOpts {
  databaseUrl: string;
  publishing: PublishingRepository;
  channels: ChannelRepository;
  registry: ChannelProviderRegistry;
  crypto: CryptoService;
  retryBaseSec: number;
}

export interface PublishingRuntime {
  scheduler: JobScheduler;
  publish: (publicationId: string) => Promise<void>;
  recover: () => Promise<{ due: number; stuck: number }>;
  startWorker(): Promise<void>;
  stop(): Promise<void>;
}

export async function createPublishingRuntime(
  opts: PublishingRuntimeOpts,
): Promise<PublishingRuntime> {
  const boss = new PgBoss({ connectionString: opts.databaseUrl });
  boss.on('error', (err) => log('error', 'pg-boss', { err: String(err) }));
  await boss.start();
  for (const q of [PUBLISH_QUEUE, RECOVER_QUEUE]) {
    await boss.createQueue(q).catch(() => {}); // idempotente entre versões
  }

  const scheduler: JobScheduler = {
    async enqueue(queue, payload, o) {
      const id = await boss.send(queue, payload, {
        ...(o?.startAfter ? { startAfter: o.startAfter } : {}),
        ...(o?.singletonKey ? { singletonKey: o.singletonKey } : {}),
        retryLimit: o?.retryLimit ?? 0, // retry de negócio é da máquina de estados, não da fila
      });
      return id ?? 'deduped';
    },
    async cancelBySingletonKey() {
      // edição/cancelamento de agendados chega na fatia de update-post
      throw new Error('cancelBySingletonKey: não implementado nesta fatia');
    },
    async schedule(queue, cron, payload) {
      await boss.schedule(queue, cron, (payload ?? {}) as object, {});
    },
  };

  const publish = makePublishPublication({
    publishing: opts.publishing,
    channels: opts.channels,
    registry: opts.registry,
    crypto: opts.crypto,
    scheduler,
    retryBaseSec: opts.retryBaseSec,
    log: (level, msg, data) => log(level, msg, data),
  });
  const recover = makeRecoverDue({
    publishing: opts.publishing,
    scheduler,
    log: (level, msg, data) => log(level, msg, data),
  });

  return {
    scheduler,
    publish,
    recover,
    async startWorker() {
      await boss.work<{ publicationId: string }>(PUBLISH_QUEUE, async (jobs) => {
        for (const job of jobs) {
          try {
            await publish(job.data.publicationId);
          } catch (err) {
            // erro inesperado de infra: loga e deixa o watchdog/scanner cuidar
            log('error', 'publish handler falhou', {
              publicationId: job.data.publicationId,
              err: String(err),
            });
          }
        }
      });
      await boss.work(RECOVER_QUEUE, async () => {
        const out = await recover();
        if (out.due || out.stuck) log('warn', 'recover-scan agiu', out);
      });
      await boss.schedule(RECOVER_QUEUE, '* * * * *', {}, {}); // barato: índices parciais
      log('info', 'worker de publicação ativo', { queues: [PUBLISH_QUEUE, RECOVER_QUEUE] });
    },
    async stop() {
      await boss.stop({ graceful: true });
    },
  };
}
