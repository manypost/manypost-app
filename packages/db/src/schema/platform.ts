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

/**
 * Franquia de IA por organização e período (SPEC_AI §3; BudgetGuard).
 *
 * `reserved` é o que está EM VOO: reservado antes da chamada ao modelo e ainda não confirmado.
 * A decisão de conceder é `granted - used - reserved >= n` num único UPDATE condicional — é o
 * bloqueio de linha do Postgres que serializa gerações simultâneas e torna impossível furar a
 * franquia (SPEC_AI §5.3), sem retry no aplicativo.
 */
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
    reserved: integer('reserved').notNull().default(0),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index('ai_credits_org_ix').on(t.orgId, t.periodEnd),
    // um balde por org/tipo/período: é o que torna a abertura do período idempotente sob corrida
    uniqueIndex('ai_credits_period_ux').on(t.orgId, t.kind, t.periodStart),
  ],
);

/**
 * Uma reserva de franquia e seu desfecho. A coluna `reserved` sozinha não bastaria: um processo
 * que morresse entre a chamada ao modelo e a confirmação vazaria franquia sem deixar rastro do
 * que vazou. Esta linha dá (a) idempotência à confirmação — transição condicional saindo de
 * RESERVED, no mesmo espírito da máquina de estados de publicação —, (b) a lease que permite
 * recuperar reserva órfã e (c) o histórico de custo por operação.
 *
 * NUNCA guarda prompt, texto gerado, credencial ou identidade do fornecedor.
 */
export const aiGrants = pgTable(
  'ai_grants',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    creditId: uuid('credit_id')
      .notNull()
      .references(() => aiCredits.id),
    /** operação de domínio que pediu (ex.: `ai.caption`) — atribuição de custo, não conteúdo */
    operation: text('operation').notNull(),
    estimatedCredits: integer('estimated_credits').notNull(),
    /** RESERVED | COMMITTED | RELEASED */
    state: text('state').notNull().default('RESERVED'),
    /** créditos realmente consumidos — só depois de COMMITTED */
    credits: integer('credits'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    /** lease: passou daqui sem resolver, a próxima reserva da org devolve o valor */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index('ai_grants_org_ix').on(t.orgId, t.createdAt),
    // varredura preguiçosa de lease vencida (sem cron — precedente do link de aprovação)
    index('ai_grants_reclaim_ix').on(t.orgId, t.state, t.expiresAt),
  ],
);

/** manypost como authorization server OAuth p/ MCP e apps de terceiros (SPEC_API_MCP §2). */
export const oauthApps = pgTable(
  'oauth_apps',
  {
    id: pk(),
    /** null = app de plataforma (static/DCR/CIMD), não amarrado a uma org */
    orgId: uuid('org_id').references(() => organizations.id),
    name: text('name').notNull(),
    clientId: text('client_id').notNull(),
    /** null = cliente público (PKCE); confidential clients guardam hash */
    clientSecretHash: text('client_secret_hash'),
    redirectUris: text('redirect_uris').array().notNull().default([]),
    scopes: text('scopes').array().notNull().default([]),
    tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
    clientUri: text('client_uri'),
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
    /** refresh anterior — reuso ⇒ revoga a família (paridade com sessions) */
    prevRefreshTokenHash: text('prev_refresh_token_hash'),
    /** RFC 8707 resource / audience do MCP */
    resource: text('resource'),
    scopes: text('scopes').array().notNull().default([]),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('oauth_grants_access_ix').on(t.accessTokenHash),
    index('oauth_grants_code_ix').on(t.codeHash),
    index('oauth_grants_refresh_ix').on(t.refreshTokenHash),
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
