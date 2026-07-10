import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { channelStatus } from './enums';
import { bytea, pk, timestamps } from './helpers';
import { organizations } from './identity';

// Derived from Postiz (AGPL-3.0): model Integration em schema.prisma — modernizado
// (tokens cifrados, status como enum, jsonb tipado). SPEC_DATA §3.
export const channels = pgTable(
  'channels',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    provider: text('provider').notNull(), // identifier do ChannelProvider
    externalId: text('external_id').notNull(), // id da conta na rede
    name: text('name').notNull(),
    username: text('username'),
    avatarUrl: text('avatar_url'),

    tokenEnc: bytea('token_enc').notNull(),
    refreshTokenEnc: bytea('refresh_token_enc'),
    tokenKeyVersion: integer('token_key_version').notNull().default(1),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    scopes: text('scopes').array().notNull().default([]),

    status: channelStatus('status').notNull().default('ACTIVE'),
    /** posting_times, custom_instance, additional settings do provider */
    settings: jsonb('settings').notNull().default({}),
    /** conta raiz quando o canal é uma sub-conta (página FB, canal YT) */
    rootExternalId: text('root_external_id'),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('channels_org_provider_ext_ux').on(t.orgId, t.provider, t.externalId),
    index('channels_org_ix').on(t.orgId),
    index('channels_refresh_needed_ix').on(t.orgId).where(sql`${t.status} = 'REFRESH_REQUIRED'`),
  ],
);
