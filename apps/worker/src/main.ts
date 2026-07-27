import { loadEnv, mediaStorageConfigFromEnv, providerSecretsFromEnv } from '@manypost/config';
import {
  createDb,
  makeChannelRepository,
  makeMediaRepository,
  makePublishingRepository,
  makeWebhookRepository,
  runMigrations,
} from '@manypost/db';
import { AesGcmCryptoService, makeMediaStorage, makePinnedFetch } from '@manypost/core';
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
  // saída endurecida na entrega de webhook — a MESMA que a api usa. Esquecer aqui repetiria a
  // divergência da decisão 20 do STATUS: quem entrega webhook em escala é este processo
  outboundFetch: makePinnedFetch({
    allowPrivate: env.WEBHOOKS_ALLOW_PRIVATE,
    timeoutMs: 10_000,
    onBlocked: ({ hostname, reason }) =>
      console.log(
        JSON.stringify({ level: 'warn', msg: 'outbound_blocked', surface: 'webhook', hostname, reason }),
      ),
  }),
  // sem isso o refresh de token (LinkedIn/X exigem client id/secret) falha no worker dedicado
  providerSecrets: providerSecretsFromEnv(env),
  // resolução de mediaSettings no publish (miniatura do YouTube: id → URL pública). MESMO
  // mapeamento de ambiente da API — api e worker não podem divergir de driver nem de URL
  media: makeMediaRepository(db),
  storage: makeMediaStorage(mediaStorageConfigFromEnv(env)),
});
await runtime.startWorker();
console.log(JSON.stringify({ level: 'info', msg: 'manypost worker ativo' }));
