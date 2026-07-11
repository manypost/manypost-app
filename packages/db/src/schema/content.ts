import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { approvalStatus, groupState, postOrigin, publicationState } from './enums';
import { bytea, pk, timestamps } from './helpers';
import { channels } from './channels';
import { organizations, users } from './identity';

// Derived from Postiz (AGPL-3.0): modelo Post-por-canal com group/parent em schema.prisma,
// renomeado para PostGroup/Publication e normalizado (SPEC_DATA §3).

export const postGroups = pgTable(
  'post_groups',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    authorId: uuid('author_id').references(() => users.id),
    /** documento rico do composer (conteúdo base compartilhado entre canais) */
    baseContent: jsonb('base_content').notNull().default({}),
    publishAt: timestamp('publish_at', { withTimezone: true }),
    timezone: text('timezone').notNull().default('UTC'),
    state: groupState('state').notNull().default('DRAFT'),
    recurrence: jsonb('recurrence'),
    origin: postOrigin('origin').notNull().default('WEB'),
    idempotencyKey: text('idempotency_key'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('post_groups_idem_ux').on(t.orgId, t.idempotencyKey),
    index('post_groups_org_state_ix').on(t.orgId, t.state),
    index('post_groups_org_publish_ix').on(t.orgId, t.publishAt),
  ],
);

export const publications = pgTable(
  'publications',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => postGroups.id),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id),
    /** conteúdo resolvido para o canal (override do composer aplicado) */
    content: jsonb('content').notNull().default({}),
    /** settings validados pelo settingsSchema do provider */
    settings: jsonb('settings').notNull().default({}),
    state: publicationState('state').notNull().default('DRAFT'),
    /** desnormalizado do grupo para o scanner e o calendário */
    publishAt: timestamp('publish_at', { withTimezone: true }),

    externalId: text('external_id'),
    releaseUrl: text('release_url'),
    errorClass: text('error_class'), // transient | refresh-token | permanent
    errorMessage: text('error_message'), // truncado a 4k na aplicação
    attemptCount: integer('attempt_count').notNull().default(0),
    /** versão do agendamento — jobs de versões anteriores são descartados (edit/cancel) */
    jobVersion: integer('job_version').notNull().default(0),
    /** cursor de thread: itens <= índice já publicados — nunca republicar (SPEC_QUEUE §7) */
    lastPublishedIndex: integer('last_published_index').notNull().default(-1),
    /** id da tentativa em curso — protocolo anti-dupla-publicação (SPEC_QUEUE §5) */
    attemptId: uuid('attempt_id'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('publications_group_channel_ux').on(t.groupId, t.channelId),
    index('publications_org_state_date_ix').on(t.orgId, t.state, t.publishAt),
    // scanner de recuperação (SPEC_QUEUE §8) — parcial e pequeno
    index('publications_due_ix').on(t.publishAt).where(sql`${t.state} = 'SCHEDULED'`),
    // watchdog de zumbis
    index('publications_stuck_ix')
      .on(t.updatedAt)
      .where(sql`${t.state} IN ('PUBLISHING', 'TOKEN_REFRESH')`),
  ],
);

export const publicationItems = pgTable(
  'publication_items',
  {
    id: pk(),
    publicationId: uuid('publication_id')
      .notNull()
      .references(() => publications.id),
    position: integer('position').notNull(), // 0 = post principal; >0 = thread/comentário
    content: jsonb('content').notNull().default({}),
    media: jsonb('media').notNull().default([]),
    delaySec: integer('delay_sec').notNull().default(0),
    externalId: text('external_id'),
    ...timestamps,
  },
  (t) => [uniqueIndex('publication_items_pos_ux').on(t.publicationId, t.position)],
);

export const publicationEvents = pgTable(
  'publication_events',
  {
    id: pk(),
    publicationId: uuid('publication_id')
      .notNull()
      .references(() => publications.id),
    fromState: publicationState('from_state'),
    toState: publicationState('to_state').notNull(),
    detail: jsonb('detail').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('publication_events_pub_ix').on(t.publicationId, t.createdAt)],
);

export const media = pgTable(
  'media',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    path: text('path').notNull(),
    mime: text('mime').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    durationSec: integer('duration_sec'),
    thumbnailPath: text('thumbnail_path'),
    alt: text('alt'),
    blurhash: text('blurhash'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('media_org_ix').on(t.orgId, t.createdAt)],
);

export const tags = pgTable(
  'tags',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6B6B70'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('tags_org_ix').on(t.orgId)],
);

export const postGroupTags = pgTable(
  'post_group_tags',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => postGroups.id),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.tagId] })],
);

export const channelSets = pgTable(
  'channel_sets',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    channelIds: uuid('channel_ids').array().notNull().default([]),
    ...timestamps,
  },
  (t) => [index('channel_sets_org_ix').on(t.orgId)],
);

export const signatures = pgTable(
  'signatures',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    content: jsonb('content').notNull().default({}),
    autoAdd: boolean('auto_add').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('signatures_org_ix').on(t.orgId)],
);

/** Aprovação por link público sem login (DECISIONS v1.1 §12; SPEC_API_MCP). */
export const approvalLinks = pgTable(
  'approval_links',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => postGroups.id),
    tokenHash: text('token_hash').notNull(), // sha256; o token em claro só existe na URL
    status: approvalStatus('status').notNull().default('PENDING'),
    feedback: text('feedback'),
    approverName: text('approver_name'),
    approverIp: text('approver_ip'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('approval_links_token_ux').on(t.tokenHash),
    // 1 link ativo por grupo
    uniqueIndex('approval_links_pending_group_ux')
      .on(t.groupId)
      .where(sql`${t.status} = 'PENDING'`),
  ],
);

/** Série diária de métricas por canal (DECISIONS §1b: dado aberto). */
export const channelMetrics = pgTable(
  'channel_metrics',
  {
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id),
    metric: text('metric').notNull(), // followers | impressions | engagement | ...
    day: date('day').notNull(),
    value: numeric('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.metric, t.day] })],
);
