import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';
export { uuidv7 } from './uuid';
export { runMigrations } from './migrate';
export * from './repositories/identity.repo';
export * from './repositories/approvals.repo';
export * from './repositories/billing.repo';
export * from './repositories/channels.repo';
export * from './repositories/media.repo';
export * from './repositories/platform.repo';
export * from './repositories/publishing.repo';
export * from './repositories/webhooks.repo';

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    onnotice: () => {}, // silencioso; logs estruturados ficam na aplicação
  });
  return drizzle(client, { schema });
}
