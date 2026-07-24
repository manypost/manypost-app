import { afterAll, describe, expect, test } from 'bun:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { makeAuthIdentityRepository } from './identity.repo';

const databaseUrl = process.env.TEST_DATABASE_URL;
const pgTest = databaseUrl ? test : test.skip;
const client = databaseUrl ? postgres(databaseUrl, { max: 6, onnotice: () => {} }) : null;
const db = client ? drizzle(client, { schema }) : null;

afterAll(async () => {
  await client?.end();
});

const input = (suffix: string, overrides: Partial<{
  providerUserId: string;
  email: string;
  orgSlug: string;
}> = {}) => ({
  provider: 'clerk',
  providerUserId: `user_clerk_${suffix}`,
  email: `${suffix}@test.dev`,
  name: `E2E ${suffix}`,
  avatarUrl: null,
  orgName: `E2E ${suffix}`,
  orgSlug: `e2e-${suffix}`,
  ...overrides,
});

describe('identity repository com PostgreSQL real', () => {
  pgTest('serializa o mesmo subject sem duplicar usuário, organização ou membership', async () => {
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const data = input(suffix);
    const repo = makeAuthIdentityRepository(db!);

    const results = await Promise.all([
      repo.resolveOrProvision(data),
      repo.resolveOrProvision(data),
      repo.resolveOrProvision(data),
    ]);

    expect(new Set(results.map((result) => result.userId)).size).toBe(1);
    expect(results.filter((result) => result.isNewUser)).toHaveLength(1);
    const [counts] = await client!`
      select
        (select count(*)::int from users where email = ${data.email}) as users,
        (select count(*)::int from auth_identities
          where provider = 'clerk' and provider_user_id = ${data.providerUserId}) as identities,
        (select count(*)::int from organizations where slug = ${data.orgSlug}) as organizations,
        (select count(*)::int from memberships m
          join users u on u.id = m.user_id where u.email = ${data.email}) as memberships
    `;
    expect(counts).toEqual({ users: 1, identities: 1, organizations: 1, memberships: 1 });
  });

  pgTest('vincula subjects concorrentes com o mesmo e-mail ao mesmo usuário', async () => {
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const email = `${suffix}@test.dev`;
    const repo = makeAuthIdentityRepository(db!);
    const first = input(`${suffix}-a`, { email });
    const second = input(`${suffix}-b`, { email });

    const results = await Promise.all([
      repo.resolveOrProvision(first),
      repo.resolveOrProvision(second),
    ]);

    expect(new Set(results.map((result) => result.userId)).size).toBe(1);
    const [counts] = await client!`
      select
        (select count(*)::int from users where email = ${email}) as users,
        (select count(*)::int from auth_identities where email = ${email}) as identities,
        (select count(*)::int from memberships m
          join users u on u.id = m.user_id where u.email = ${email}) as memberships
    `;
    expect(counts).toEqual({ users: 1, identities: 2, memberships: 1 });
  });

  pgTest('reverte o usuário quando a criação da organização falha', async () => {
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const data = input(suffix);
    await client!`
      insert into organizations (id, name, slug)
      values (${crypto.randomUUID()}, 'slug reservado', ${data.orgSlug})
    `;
    const repo = makeAuthIdentityRepository(db!);

    await expect(repo.resolveOrProvision(data)).rejects.toBeDefined();

    const [counts] = await client!`
      select
        (select count(*)::int from users where email = ${data.email}) as users,
        (select count(*)::int from auth_identities
          where provider = 'clerk' and provider_user_id = ${data.providerUserId}) as identities,
        (select count(*)::int from memberships m
          join users u on u.id = m.user_id where u.email = ${data.email}) as memberships
    `;
    expect(counts).toEqual({ users: 0, identities: 0, memberships: 0 });
  });
});
