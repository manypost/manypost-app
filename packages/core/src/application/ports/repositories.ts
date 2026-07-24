import type { MemberRole } from '@manypost/contracts';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(data: {
    email: string;
    passwordHash: string | null; // null = conta apenas social
    name: string | null;
    avatarUrl?: string | null;
    timezone?: string;
    locale?: string;
  }): Promise<UserRecord>;
  /** usa a foto do provedor social apenas quando o usuário ainda não tem uma */
  updateAvatarIfEmpty(userId: string, avatarUrl: string): Promise<void>;
}

export interface AuthIdentityRepository {
  find(provider: string, providerUserId: string): Promise<{ userId: string } | null>;
  resolveOrProvision(data: {
    provider: string;
    providerUserId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    orgName: string;
    orgSlug: string;
  }): Promise<{ userId: string; isNewUser: boolean }>;
}

export interface OrgRecord {
  id: string;
  name: string;
  slug: string;
}

/** Org com o vínculo de cobrança (`cus_…` da Stripe) — só existe no gerenciado. */
export interface OrgBillingRecord extends OrgRecord {
  billingCustomerId: string | null;
}

export interface OrganizationRepository {
  /** cria org + membership OWNER atomicamente */
  createWithOwner(data: { name: string; slug: string; ownerId: string }): Promise<OrgRecord>;
  findMembership(orgId: string, userId: string): Promise<{ role: MemberRole } | null>;
  listForUser(userId: string): Promise<Array<OrgRecord & { role: MemberRole }>>;
  findById(orgId: string): Promise<OrgBillingRecord | null>;
  /** resolve a org dona de um Customer da Stripe (webhook chega só com o customer) */
  findByBillingCustomerId(customerId: string): Promise<OrgBillingRecord | null>;
  setBillingCustomerId(orgId: string, customerId: string): Promise<void>;
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
