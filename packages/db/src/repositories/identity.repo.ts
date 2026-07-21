import { and, desc, eq, isNull, or } from 'drizzle-orm';
import type {
  ApiKeyRepository,
  AuthIdentityRepository,
  OrganizationRepository,
  SessionRepository,
  UserRepository,
} from '@manypost/core';
import type { Db } from '../index';
import { apiKeys, authIdentities, memberships, organizations, sessions, users } from '../schema';

export function makeUserRepository(db: Db): UserRepository {
  return {
    async findByEmail(email) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row ?? null;
    },
    async findById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return row ?? null;
    },
    async create(data) {
      const [row] = await db
        .insert(users)
        .values({
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
          avatarUrl: data.avatarUrl ?? null,
          ...(data.timezone ? { timezone: data.timezone } : {}),
          ...(data.locale ? { locale: data.locale } : {}),
        })
        .returning();
      return row!;
    },
    async updateAvatarIfEmpty(userId, avatarUrl) {
      await db
        .update(users)
        .set({ avatarUrl })
        .where(and(eq(users.id, userId), isNull(users.avatarUrl)));
    },
  };
}

export function makeAuthIdentityRepository(db: Db): AuthIdentityRepository {
  return {
    async find(provider, providerUserId) {
      const [row] = await db
        .select({ userId: authIdentities.userId })
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.provider, provider),
            eq(authIdentities.providerUserId, providerUserId),
          ),
        )
        .limit(1);
      return row ?? null;
    },
    async link(data) {
      await db.insert(authIdentities).values(data).onConflictDoNothing();
    },
  };
}

export function makeOrganizationRepository(db: Db): OrganizationRepository {
  return {
    async createWithOwner(data) {
      return db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({ name: data.name, slug: data.slug })
          .returning();
        await tx.insert(memberships).values({
          orgId: org!.id,
          userId: data.ownerId,
          role: 'OWNER',
        });
        return org!;
      });
    },
    async findMembership(orgId, userId) {
      const [row] = await db
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
        .limit(1);
      return row ?? null;
    },
    async listForUser(userId) {
      return db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.orgId))
        .where(eq(memberships.userId, userId))
        .orderBy(memberships.createdAt);
    },
    async findById(orgId) {
      const [row] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      return row ?? null;
    },
    async findByBillingCustomerId(customerId) {
      const [row] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.billingCustomerId, customerId))
        .limit(1);
      return row ?? null;
    },
    async setBillingCustomerId(orgId, customerId) {
      await db
        .update(organizations)
        .set({ billingCustomerId: customerId })
        .where(eq(organizations.id, orgId));
    },
  };
}

export function makeSessionRepository(db: Db): SessionRepository {
  return {
    async create(data) {
      const [row] = await db
        .insert(sessions)
        .values({
          userId: data.userId,
          refreshTokenHash: data.refreshTokenHash,
          expiresAt: data.expiresAt,
          userAgent: data.userAgent ?? null,
          ip: data.ip ?? null,
        })
        .returning();
      return row!;
    },
    async findByTokenHash(hash) {
      const [row] = await db
        .select()
        .from(sessions)
        .where(or(eq(sessions.refreshTokenHash, hash), eq(sessions.prevTokenHash, hash)))
        .limit(1);
      if (!row) return null;
      return {
        session: row,
        matched: row.refreshTokenHash === hash ? ('current' as const) : ('previous' as const),
      };
    },
    async rotate(id, newHash) {
      const [current] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      if (!current) return;
      await db
        .update(sessions)
        .set({
          prevTokenHash: current.refreshTokenHash,
          refreshTokenHash: newHash,
          lastRotatedAt: new Date(),
        })
        .where(eq(sessions.id, id));
    },
    async revoke(id) {
      await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, id));
    },
  };
}

export function makeApiKeyRepository(db: Db): ApiKeyRepository {
  return {
    async create(data) {
      const [row] = await db.insert(apiKeys).values(data).returning();
      return row!;
    },
    async findActiveByHash(keyHash) {
      const [row] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
        .limit(1);
      return row ?? null;
    },
    async list(orgId) {
      return db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.orgId, orgId))
        .orderBy(desc(apiKeys.createdAt));
    },
    async revoke(orgId, id) {
      const rows = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
        .returning({ id: apiKeys.id });
      return rows.length > 0;
    },
    async touchLastUsed(id) {
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
    },
  };
}
