import PgBoss from 'pg-boss';
import { loadEnv } from '@postaq/config';

/**
 * Worker pg-boss (SPEC_QUEUE_PUBLISHING).
 * Fase 1: handlers/publish (pipeline + state machine + rate-limit Redis),
 * handlers/refresh-token, handlers/recover-scan (cron 5min), handlers/webhook-delivery.
 */
const env = loadEnv();
const boss = new PgBoss({ connectionString: env.DATABASE_URL });

boss.on('error', (err) => console.error(JSON.stringify({ level: 'error', msg: 'pg-boss', err: String(err) })));

await boss.start();
console.log(`postaq worker (MODE=${env.MODE}) conectado ao pg-boss`);

// Exemplo de fiação (substituído pelos handlers reais na fase 1):
await boss.work('publish', async ([job]) => {
  console.log(JSON.stringify({ level: 'info', msg: 'publish job recebido', id: job?.id }));
});
