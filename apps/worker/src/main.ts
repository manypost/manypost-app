import { loadEnv } from '@manypost/config';
import {
  createDb,
  makeChannelRepository,
  makePublishingRepository,
  makeWebhookRepository,
  runMigrations,
} from '@manypost/db';
import { AesGcmCryptoService } from '@manypost/core';
import { providerRegistry } from '@manypost/providers';
import { createPublishingRuntime } from '@manypost/queue';
import { fileURLToPath } from 'node:url';

/** Worker dedicado (MODE=worker em escala; no self-host pequeno a api MODE=all já consome a fila). */
const env = loadEnv();

if (env.DB_MIGRATE === 'auto') {
  await runMigrations(
    env.DATABASE_URL,
    fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  );
}

const db = createDb(env.DATABASE_URL);
const runtime = await createPublishingRuntime({
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  publishing: makePublishingRepository(db),
  channels: makeChannelRepository(db),
  webhooks: makeWebhookRepository(db),
  registry: providerRegistry,
  crypto: AesGcmCryptoService.fromHex(env.ENCRYPTION_KEY),
  retryBaseSec: env.PUBLISH_RETRY_BASE_SEC,
  allowPrivateWebhookUrls: env.WEBHOOKS_ALLOW_PRIVATE,
});
await runtime.startWorker();
console.log(JSON.stringify({ level: 'info', msg: 'manypost worker ativo' }));
