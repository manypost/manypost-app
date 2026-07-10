import type { MemberRole } from '@manypost/contracts';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string | null;
  timezone: string;
  locale: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(data: {
    email: string;
    passwordHash: string;
    name: string | null;
    timezone?: string;
    locale?: string;
  }): Promise<UserRecord>;
}

export interface OrgRecord {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationRepository {
  /** cria org + membership OWNER atomicamente */
  createWithOwner(data: { name: string; slug: string; ownerId: string }): Promise<OrgRecord>;
  findMembership(orgId: string, userId: string): Promise<{ role: MemberRole } | null>;
  listForUser(userId: string): Promise<Array<OrgRecord & { role: MemberRole }>>;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionRepository {
  create(data: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }): Promise<SessionRecord>;
  /** procura pelo hash atual OU pelo anterior (detecção de reuso) */
  findByTokenHash(
    hash: string,
  ): Promise<{ session: SessionRecord; matched: 'current' | 'previous' } | null>;
  /** prev = atual; atual = novo (rotação in-place) */
  rotate(id: string, newHash: string): Promise<void>;
  revoke(id: string): Promise<void>;
}

export interface ApiKeyRecord {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyRepository {
  create(data: {
    orgId: string;
    name: string;
    keyHash: string;
    prefix: string;
    scopes: string[];
  }): Promise<ApiKeyRecord>;
  findActiveByHash(keyHash: string): Promise<ApiKeyRecord | null>;
  list(orgId: string): Promise<ApiKeyRecord[]>;
  revoke(orgId: string, id: string): Promise<boolean>;
  touchLastUsed(id: string): Promise<void>;
}
