import { afterAll, describe, expect, test } from 'bun:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { makeApprovalLinkRepository } from './approvals.repo';
import { makeSubscriptionRepository } from './billing.repo';
import { makeChannelRepository } from './channels.repo';
import { makeMediaRepository } from './media.repo';
import { makeOAuthAppRepository, makeOAuthGrantRepository } from './oauth.repo';
import { makeNotificationRepository } from './platform.repo';
import { makeWebhookRepository } from './webhooks.repo';

/**
 * Escopo por organização, repo a repo (spec repository-governance: "Every repository proves
 * organization scoping"). O padrão de cada teste é o mesmo: um recurso nasce na org A e a org B
 * não consegue LÊ-LO nem MUTÁ-LO — um `where org_id` esquecido falha aqui, em vez de vazar dado
 * de um cliente para outro em produção. Requer PostgreSQL real (TEST_DATABASE_URL) e migrations
 * aplicadas, como as demais suítes `*.integration.test.ts`.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
const pgTest = databaseUrl ? test : test.skip;
const client = databaseUrl ? postgres(databaseUrl, { max: 6, onnotice: () => {} }) : null;
const db = client ? drizzle(client, { schema }) : null;

afterAll(async () => {
  await client?.end();
});

/** duas organizações novas por teste — nada de estado compartilhado entre suítes */
async function duasOrgs(): Promise<{ orgA: string; orgB: string }> {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  await client!`
    insert into organizations (id, name, slug) values
      (${orgA}, ${`Org A ${suffix}`}, ${`scope-a-${suffix}`}),
      (${orgB}, ${`Org B ${suffix}`}, ${`scope-b-${suffix}`})
  `;
  return { orgA, orgB };
}

const bytes = () => new TextEncoder().encode(`cifrado-${crypto.randomUUID()}`);

describe('escopo por organização nos repositórios', () => {
  pgTest('media: outra org não lista, não resolve, não edita nem apaga', async () => {
    const { orgA, orgB } = await duasOrgs();
    const repo = makeMediaRepository(db!);
    const created = await repo.create({
      orgId: orgA,
      path: `${orgA}/${crypto.randomUUID()}.png`,
      mime: 'image/png',
      byteSize: 123,
      width: 10,
      height: 10,
      alt: 'da org A',
    });

    expect((await repo.list(orgB)).map((m) => m.id)).not.toContain(created.id);
    expect(await repo.findMany(orgB, [created.id])).toHaveLength(0);
    expect(await repo.setAlt(orgB, created.id, 'invadido')).toBe(false);
    expect(await repo.softDelete(orgB, created.id)).toBe(false);
    // a org dona segue vendo o registro intacto
    const [mine] = await repo.findMany(orgA, [created.id]);
    expect(mine?.alt).toBe('da org A');
  });

  pgTest('channels: outra org não lista, não resolve e não desconecta', async () => {
    const { orgA, orgB } = await duasOrgs();
    const repo = makeChannelRepository(db!);
    const ch = await repo.upsert({
      orgId: orgA,
      provider: 'fake',
      externalId: `ext-${crypto.randomUUID()}`,
      name: 'Canal A',
      username: null,
      avatarUrl: null,
      scopes: [],
      settings: {},
      tokenEnc: bytes(),
      refreshTokenEnc: null,
      tokenKeyVersion: 1,
      tokenExpiresAt: null,
    });

    expect((await repo.list(orgB)).map((c) => c.id)).not.toContain(ch.id);
    expect(await repo.findMany(orgB, [ch.id])).toHaveLength(0);
    expect(await repo.softDelete(orgB, ch.id)).toBe(false);
    expect((await repo.list(orgA)).map((c) => c.id)).toContain(ch.id);
  });

  pgTest('webhooks: outra org não lista, não recebe eventos nem apaga', async () => {
    const { orgA, orgB } = await duasOrgs();
    const repo = makeWebhookRepository(db!);
    const hook = await repo.create({
      orgId: orgA,
      name: 'hook A',
      url: 'https://example.test/hook',
      events: ['post.published'],
      channelIds: [],
      secretEnc: bytes(),
      secretKeyVersion: 1,
    });

    expect((await repo.list(orgB)).map((w) => w.id)).not.toContain(hook.id);
    expect(
      (await repo.findForEvent(orgB, 'post.published')).map((w) => w.id),
    ).not.toContain(hook.id);
    expect(await repo.softDelete(orgB, hook.id)).toBe(false);
    expect((await repo.findForEvent(orgA, 'post.published')).map((w) => w.id)).toContain(hook.id);
  });

  pgTest('notifications: outra org não lê, não marca lida e não marca em massa', async () => {
    const { orgA, orgB } = await duasOrgs();
    const repo = makeNotificationRepository(db!);
    await repo.create({ orgId: orgA, kind: 'post_failed', title: 'da org A' });
    const [minha] = await repo.list(orgA);
    expect(minha).toBeDefined();

    expect((await repo.list(orgB)).map((n) => n.id)).not.toContain(minha!.id);
    expect(await repo.markRead(orgB, minha!.id)).toBe(false);
    expect(await repo.markAllRead(orgB)).toBe(0);
    const [aindaNaoLida] = await repo.list(orgA);
    expect(aindaNaoLida?.readAt).toBeNull();
  });

  pgTest('approvals: outra org não vê o link do grupo e não revoga o pendente', async () => {
    const { orgA, orgB } = await duasOrgs();
    const groupId = crypto.randomUUID();
    await client!`
      insert into post_groups (id, org_id, base_content, publish_at, timezone, state, origin)
      values (${groupId}, ${orgA}, ${JSON.stringify({ text: 'post' })}::jsonb, now(), 'UTC', 'DRAFT', 'WEB')
    `;
    const repo = makeApprovalLinkRepository(db!);
    const link = await repo.create({
      orgId: orgA,
      groupId,
      tokenHash: crypto.randomUUID().replaceAll('-', ''),
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    expect(await repo.latestByGroup(orgB, groupId)).toBeNull();
    expect(await repo.revokePending(orgB, groupId)).toBe(0);
    const daDona = await repo.latestByGroup(orgA, groupId);
    expect(daDona?.id).toBe(link.id);
    expect(daDona?.status).toBe('PENDING');
  });

  pgTest('billing: a assinatura de uma org não aparece para outra', async () => {
    const { orgA, orgB } = await duasOrgs();
    const repo = makeSubscriptionRepository(db!);
    await repo.upsertByOrg({
      orgId: orgA,
      customerId: `cus_${crypto.randomUUID().slice(0, 12)}`,
      subscriptionId: null,
      tier: 'PRO',
      period: 'MONTHLY',
      status: 'ACTIVE',
      currentPeriodEnd: null,
      cancelAt: null,
      identifier: null,
    });

    expect(await repo.findByOrg(orgB)).toBeNull();
    expect((await repo.findByOrg(orgA))?.tier).toBe('PRO');
  });

  pgTest('oauth: cada grant resolve para a SUA org — o hash não vaza entre tenants', async () => {
    const { orgA, orgB } = await duasOrgs();
    const suffix = crypto.randomUUID().slice(0, 8);
    const userId = crypto.randomUUID();
    await client!`
      insert into users (id, email, password_hash, name)
      values (${userId}, ${`scope-${suffix}@test.dev`}, null, 'Scope')
    `;
    const apps = makeOAuthAppRepository(db!);
    const app = await apps.create({
      orgId: null,
      name: `app-${suffix}`,
      clientId: `client-${suffix}`,
      clientSecretHash: null,
      redirectUris: ['https://example.test/cb'],
      scopes: ['mcp'],
      tokenEndpointAuthMethod: 'none',
      clientUri: null,
    });
    const grants = makeOAuthGrantRepository(db!);
    const hashA = `hash-a-${suffix}`;
    const hashB = `hash-b-${suffix}`;
    await grants.create({
      oauthAppId: app.id,
      orgId: orgA,
      userId,
      codeHash: hashA,
      codeChallenge: 'challenge',
      codeExpiresAt: new Date(Date.now() + 600_000),
      resource: null,
      scopes: ['mcp'],
    });
    await grants.create({
      oauthAppId: app.id,
      orgId: orgB,
      userId,
      codeHash: hashB,
      codeChallenge: 'challenge',
      codeExpiresAt: new Date(Date.now() + 600_000),
      resource: null,
      scopes: ['mcp'],
    });

    expect((await grants.findByCodeHash(hashA))?.orgId).toBe(orgA);
    expect((await grants.findByCodeHash(hashB))?.orgId).toBe(orgB);
  });
});
