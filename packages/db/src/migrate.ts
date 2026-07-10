import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Lock advisory para que N réplicas subindo juntas não migrem em paralelo (SPEC_INFRA §2). */
const MIGRATION_LOCK = 72_019_001;

export async function runMigrations(connectionString: string, migrationsFolder: string) {
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK})`;
    await migrate(drizzle(sql), { migrationsFolder });
  } finally {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK})`.catch(() => {});
    await sql.end();
  }
}
