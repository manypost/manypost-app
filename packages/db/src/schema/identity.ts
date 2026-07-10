import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { memberRole } from './enums';
import { pk, timestamps } from './helpers';

export const users = pgTable(
  'users',
  {
    id: pk(),
    email: text('email').notNull(), // normalizado para lowercase na aplicação
    passwordHash: text('password_hash'), // null quando SSO
    name: text('name'),
    timezone: text('timezone').notNull().default('UTC'), // IANA (ex.: America/Sao_Paulo)
    locale: text('locale').notNull().default('pt-BR'),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_ux').on(t.email)],
);

export const organizations = pgTable(
  'organizations',
  {
    id: pk(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    settings: jsonb('settings').notNull().default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex('organizations_slug_ux').on(t.slug)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: memberRole('role').notNull().default('MEMBER'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('memberships_org_user_ux').on(t.orgId, t.userId),
    index('memberships_user_ix').on(t.userId),
  ],
);

/**
 * Refresh tokens com rotação e detecção de reuso (SPEC_API_MCP §2).
 * 1 linha = 1 família de sessão: o hash rotaciona in-place e o hash anterior fica em
 * prev_token_hash — token apresentado que casa com o anterior = reuso (roubo) → revoga.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    prevTokenHash: text('prev_token_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ip: text('ip'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('sessions_refresh_hash_ux').on(t.refreshTokenHash),
    index('sessions_prev_hash_ix').on(t.prevTokenHash),
    index('sessions_user_ix').on(t.userId),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(), // sha256 — a chave em claro só aparece na criação
    prefix: text('prefix').notNull(), // 8 chars visíveis p/ identificação
    scopes: text('scopes').array().notNull().default([]),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('api_keys_hash_ux').on(t.keyHash),
    index('api_keys_prefix_ix').on(t.prefix).where(sql`${t.revokedAt} IS NULL`),
    index('api_keys_org_ix').on(t.orgId),
  ],
);
