import { afterAll, describe, expect, test } from 'bun:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { makePublishingRepository } from './publishing.repo';

/**
 * O claim é UMA instrução `INSERT ... SELECT ... ON CONFLICT DO UPDATE WHERE` — o dublê em
 * memória do core espelha a semântica, mas só o Postgres prova que a instrução existe, que o
 * `ON CONFLICT` casa com o índice único e que duas conexões concorrentes não ganham a mesma
 * posse. É por isso que este arquivo é integração e não unitário.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
const pgTest = databaseUrl ? test : test.skip;
const client = databaseUrl ? postgres(databaseUrl, { max: 6, onnotice: () => {} }) : null;
const db = client ? drizzle(client, { schema }) : null;

afterAll(async () => {
  await client?.end();
});

/** organização + canal + grupo + publicação PUBLISHING com 1 item, prontos para reivindicar. */
async function seed(suffix: string) {
  const sqlc = client!;
  const [org] = await sqlc<{ id: string }[]>`
    INSERT INTO organizations (id, name, slug) VALUES (gen_random_uuid(), ${`Att ${suffix}`}, ${`att-${suffix}`})
    RETURNING id`;
  const [ch] = await sqlc<{ id: string }[]>`
    INSERT INTO channels (id, org_id, provider, external_id, name, scopes, token_enc, token_key_version)
    VALUES (gen_random_uuid(), ${org!.id}, 'fake', ${`ext-${suffix}`}, 'Canal', '{}', '\\x00', 1)
    RETURNING id`;
  const [group] = await sqlc<{ id: string }[]>`
    INSERT INTO post_groups (id, org_id, state) VALUES (gen_random_uuid(), ${org!.id}, 'SCHEDULED')
    RETURNING id`;
  const [pub] = await sqlc<{ id: string }[]>`
    INSERT INTO publications (id, org_id, group_id, channel_id, state, last_published_index, job_version)
    VALUES (gen_random_uuid(), ${org!.id}, ${group!.id}, ${ch!.id}, 'PUBLISHING', -1, 0)
    RETURNING id`;
  const [item] = await sqlc<{ id: string }[]>`
    INSERT INTO publication_items (id, publication_id, position, content)
    VALUES (gen_random_uuid(), ${pub!.id}, 0, '{"text":"olá"}')
    RETURNING id`;
  return { orgId: org!.id, publicationId: pub!.id, itemId: item!.id };
}

const claimArgs = (publicationId: string) => ({
  publicationId,
  jobVersion: 0,
  position: 0,
  leaseSec: 900,
});

async function seedSummaryPublication(input: {
  orgId: string;
  channelId: string;
  state: 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
  at: Date;
}) {
  const timestamp = input.at.toISOString();
  const [group] = await client!<{ id: string }[]>`
    INSERT INTO post_groups (id, org_id, state, publish_at)
    VALUES (
      gen_random_uuid(), ${input.orgId},
      ${input.state === 'PUBLISHED' ? 'DONE' : 'SCHEDULED'},
      ${timestamp}::timestamptz
    )
    RETURNING id`;
  await client!`
    INSERT INTO publications (
      id, org_id, group_id, channel_id, state, publish_at, published_at, updated_at, content
    )
    VALUES (
      gen_random_uuid(), ${input.orgId}, ${group!.id}, ${input.channelId}, ${input.state},
      ${timestamp}::timestamptz,
      ${input.state === 'PUBLISHED' ? timestamp : null}::timestamptz,
      ${timestamp}::timestamptz,
      '{"text":"limite"}'
    )`;
}

describe('posse de entrega com PostgreSQL real', () => {
  pgTest('só um dono ganha a posse; a chave de idempotência é estável entre tentativas', async () => {
    const repo = makePublishingRepository(db!);
    const { publicationId } = await seed(`${Date.now()}-a`);

    // duas conexões disputando o MESMO item: o índice único serializa, uma perde
    const [first, second] = await Promise.all([
      repo.claimItem(claimArgs(publicationId)),
      repo.claimItem(claimArgs(publicationId)),
    ]);
    const winners = [first, second].filter((c) => c !== null);
    expect(winners).toHaveLength(1);

    const winner = winners[0]!;
    expect(winner.idempotencyKey).toMatch(/^[0-9a-f]{64}$/); // sha256 hex, sem id interno em claro
    expect(winner.attemptCount).toBe(1);

    // falhou em segurança → reivindicável de novo, com a MESMA chave e outro token
    await repo.releaseItem(winner.ownerToken, 'FAILED_SAFE');
    const retry = await repo.claimItem(claimArgs(publicationId));
    expect(retry).not.toBeNull();
    expect(retry!.idempotencyKey).toBe(winner.idempotencyKey);
    expect(retry!.ownerToken).not.toBe(winner.ownerToken);
    expect(retry!.attemptCount).toBe(2);
  });

  pgTest('versão de job obsoleta, cursor divergente e estado errado não concedem posse', async () => {
    const repo = makePublishingRepository(db!);
    const { publicationId } = await seed(`${Date.now()}-b`);

    expect(await repo.claimItem({ ...claimArgs(publicationId), jobVersion: 7 })).toBeNull();
    expect(await repo.claimItem({ ...claimArgs(publicationId), position: 3 })).toBeNull();
    await client!`UPDATE publications SET state = 'SCHEDULED' WHERE id = ${publicationId}`;
    expect(await repo.claimItem(claimArgs(publicationId))).toBeNull();
  });

  pgTest('confirmar exige a posse: dono substituído não avança o cursor', async () => {
    const repo = makePublishingRepository(db!);
    const { orgId, publicationId, itemId } = await seed(`${Date.now()}-c`);

    const stale = (await repo.claimItem(claimArgs(publicationId)))!;
    // a lease vence e outro worker assume o item
    await client!`UPDATE publication_attempts SET lease_expires_at = now() - interval '1 minute'
                  WHERE publication_id = ${publicationId}`;
    const fresh = (await repo.claimItem(claimArgs(publicationId)))!;
    expect(fresh.ownerToken).not.toBe(stale.ownerToken);

    expect(
      await repo.confirmItem(publicationId, itemId, 0, stale.ownerToken, { externalId: 'x' }),
    ).toBe(false);
    const [afterStale] = await client!<{ last_published_index: number }[]>`
      SELECT last_published_index FROM publications WHERE id = ${publicationId}`;
    expect(afterStale!.last_published_index).toBe(-1);

    expect(
      await repo.confirmItem(publicationId, itemId, 0, fresh.ownerToken, {
        externalId: 'ext-1',
        releaseUrl: 'https://rede/p/1',
      }),
    ).toBe(true);
    const [row] = await client!<{ last_published_index: number; external_id: string }[]>`
      SELECT last_published_index, external_id FROM publications WHERE id = ${publicationId}`;
    expect(row!.last_published_index).toBe(0);
    expect(row!.external_id).toBe('ext-1');

    // item confirmado é intransponível, mesmo com a publicação forçada de volta
    await client!`UPDATE publications SET state = 'PUBLISHING', last_published_index = -1
                  WHERE id = ${publicationId}`;
    expect(await repo.claimItem(claimArgs(publicationId))).toBeNull();
    expect(await repo.abandonAttempts(orgId, publicationId)).toBe(0); // nada CLAIMED a abandonar
  });

  pgTest('abandono de lease é escopado por organização', async () => {
    const repo = makePublishingRepository(db!);
    const { orgId, publicationId } = await seed(`${Date.now()}-d`);
    const other = await seed(`${Date.now()}-e`);
    await repo.claimItem(claimArgs(publicationId));

    expect(await repo.abandonAttempts(other.orgId, publicationId)).toBe(0);
    const [untouched] = await client!<{ state: string }[]>`
      SELECT state FROM publication_attempts WHERE publication_id = ${publicationId}`;
    expect(untouched!.state).toBe('CLAIMED');

    expect(await repo.abandonAttempts(orgId, publicationId)).toBe(1);
    const [abandoned] = await client!<{ state: string }[]>`
      SELECT state FROM publication_attempts WHERE publication_id = ${publicationId}`;
    expect(abandoned!.state).toBe('INDETERMINATE');
    // e depois de abandonada ninguém reivindica: o desfecho é desconhecido
    expect(await repo.claimItem(claimArgs(publicationId))).toBeNull();
  });
});

describe('resumo operacional com PostgreSQL real', () => {
  pgTest('usa os limites civis explícitos num dia de 23h e não mistura organizações', async () => {
    const suffix = `${Date.now()}-dst`;
    const [org] = await client!<{ id: string }[]>`
      INSERT INTO organizations (id, name, slug)
      VALUES (gen_random_uuid(), 'DST Alfa', ${`dst-alfa-${suffix}`}) RETURNING id`;
    const [otherOrg] = await client!<{ id: string }[]>`
      INSERT INTO organizations (id, name, slug)
      VALUES (gen_random_uuid(), 'DST Beta', ${`dst-beta-${suffix}`}) RETURNING id`;
    const [channel] = await client!<{ id: string }[]>`
      INSERT INTO channels (id, org_id, provider, external_id, name, scopes, token_enc, token_key_version)
      VALUES (gen_random_uuid(), ${org!.id}, 'fake', ${`dst-${suffix}`}, 'DST', '{}', '\\x00', 1)
      RETURNING id`;
    const [otherChannel] = await client!<{ id: string }[]>`
      INSERT INTO channels (id, org_id, provider, external_id, name, scopes, token_enc, token_key_version)
      VALUES (gen_random_uuid(), ${otherOrg!.id}, 'fake', ${`dst-other-${suffix}`}, 'DST Beta', '{}', '\\x00', 1)
      RETURNING id`;

    // Lisboa em 29/03/2026: [00:00Z, 23:00Z) é o dia civil inteiro (23 horas).
    await seedSummaryPublication({
      orgId: org!.id,
      channelId: channel!.id,
      state: 'SCHEDULED',
      at: new Date('2026-03-29T22:59:59.999Z'),
    });
    await seedSummaryPublication({
      orgId: org!.id,
      channelId: channel!.id,
      state: 'SCHEDULED',
      at: new Date('2026-03-29T23:00:00.000Z'),
    });
    await seedSummaryPublication({
      orgId: org!.id,
      channelId: channel!.id,
      state: 'SCHEDULED',
      at: new Date('2026-04-04T22:59:59.999Z'),
    });
    await seedSummaryPublication({
      orgId: org!.id,
      channelId: channel!.id,
      state: 'SCHEDULED',
      at: new Date('2026-04-04T23:00:00.000Z'),
    });
    await seedSummaryPublication({
      orgId: org!.id,
      channelId: channel!.id,
      state: 'PUBLISHED',
      at: new Date('2026-03-29T22:59:59.999Z'),
    });
    await seedSummaryPublication({
      orgId: org!.id,
      channelId: channel!.id,
      state: 'FAILED',
      at: new Date('2026-03-29T22:59:59.999Z'),
    });
    await seedSummaryPublication({
      orgId: otherOrg!.id,
      channelId: otherChannel!.id,
      state: 'SCHEDULED',
      at: new Date('2026-03-29T12:00:00.000Z'),
    });

    const summary = await makePublishingRepository(db!).summarize(org!.id, {
      dayStart: new Date('2026-03-29T00:00:00.000Z'),
      dayEnd: new Date('2026-03-29T23:00:00.000Z'),
      weekEnd: new Date('2026-04-04T23:00:00.000Z'),
      timezone: 'Europe/Lisbon',
    });

    expect(summary.todayScheduled).toBe(1);
    expect(summary.todayPublished).toBe(1);
    expect(summary.todayFailed).toBe(1);
    expect(summary.weekByDay).toEqual([1, 1, 0, 0, 0, 0, 1]);
    expect(summary.weekByDay.reduce((sum, count) => sum + count, 0)).toBe(3);
  });
});
