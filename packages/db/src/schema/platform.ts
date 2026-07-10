import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { actorType } from './enums';
import { bytea, pk, timestamps } from './helpers';
import { organizations, users } from './identity';

export const webhooks = pgTable(
  'webhooks',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    url: text('url').notNull(),
    secretEnc: bytea('secret_enc').notNull(), // HMAC secret cifrado at-rest
    secretKeyVersion: integer('secret_key_version').notNull().default(1),
    events: text('events').array().notNull().default([]),
    channelIds: uuid('channel_ids').array().notNull().default([]), // vazio = todos
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('webhooks_org_ix').on(t.orgId)],
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: pk(),
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('PENDING'), // PENDING|DELIVERED|FAILED
    attempts: integer('attempts').notNull().default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('webhook_deliveries_retry_ix')
      .on(t.nextRetryAt)
      .where(sql`${t.status} = 'PENDING'`),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id), // null = toda a org
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_org_ix').on(t.orgId, t.createdAt)],
);

/** Trilha de auditoria central (SPEC_BACKEND §4.6). Particionamento por mês: fase de escala. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    actorType: actorType('actor_type').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(), // ex.: post.schedule, channel.connect
    targetType: text('target_type'),
    targetId: text('target_id'),
    detail: jsonb('detail').notNull().default({}),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_org_ix').on(t.orgId, t.createdAt)],
);

/** Franquia de IA por organização (SPEC_AI §3; BudgetGuard). */
export const aiCredits = pgTable(
  'ai_credits',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    kind: text('kind').notNull().default('general'),
    granted: integer('granted').notNull(),
    used: integer('used').notNull().default(0),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('ai_credits_org_ix').on(t.orgId, t.periodEnd)],
);

/** manypost como authorization server OAuth p/ MCP e apps de terceiros (SPEC_API_MCP §2). */
export const oauthApps = pgTable(
  'oauth_apps',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    clientId: text('client_id').notNull(),
    clientSecretHash: text('client_secret_hash').notNull(),
    redirectUris: text('redirect_uris').array().notNull().default([]),
    scopes: text('scopes').array().notNull().default([]),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('oauth_apps_client_ux').on(t.clientId)],
);

export const oauthGrants = pgTable(
  'oauth_grants',
  {
    id: pk(),
    oauthAppId: uuid('oauth_app_id')
      .notNull()
      .references(() => oauthApps.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    codeHash: text('code_hash'),
    codeChallenge: text('code_challenge'), // PKCE S256
    codeExpiresAt: timestamp('code_expires_at', { withTimezone: true }),
    accessTokenHash: text('access_token_hash'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenHash: text('refresh_token_hash'),
    scopes: text('scopes').array().notNull().default([]),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('oauth_grants_access_ix').on(t.accessTokenHash),
    index('oauth_grants_code_ix').on(t.codeHash),
    index('oauth_grants_app_user_ix').on(t.oauthAppId, t.userId),
  ],
);

/** Idempotência de POSTs públicos (SPEC_BACKEND §4.5). */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    response: jsonb('response'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.key] })],
);
