import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { OAuthAppRepository, OAuthGrantRepository } from '@manypost/core';
import type { Db } from '../index';
import { oauthApps, oauthGrants } from '../schema/platform';

function mapApp(row: typeof oauthApps.$inferSelect) {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    clientId: row.clientId,
    clientSecretHash: row.clientSecretHash,
    redirectUris: row.redirectUris,
    scopes: row.scopes,
    tokenEndpointAuthMethod: row.tokenEndpointAuthMethod,
    clientUri: row.clientUri,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
  };
}

function mapGrant(row: typeof oauthGrants.$inferSelect) {
  return {
    id: row.id,
    oauthAppId: row.oauthAppId,
    orgId: row.orgId,
    userId: row.userId,
    codeHash: row.codeHash,
    codeChallenge: row.codeChallenge,
    codeExpiresAt: row.codeExpiresAt,
    accessTokenHash: row.accessTokenHash,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    refreshTokenHash: row.refreshTokenHash,
    prevRefreshTokenHash: row.prevRefreshTokenHash,
    resource: row.resource,
    scopes: row.scopes,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export function makeOAuthAppRepository(db: Db): OAuthAppRepository {
  return {
    async findByClientId(clientId) {
      const [row] = await db
        .select()
        .from(oauthApps)
        .where(and(eq(oauthApps.clientId, clientId), isNull(oauthApps.deletedAt)))
        .limit(1);
      return row ? mapApp(row) : null;
    },
    async create(data) {
      const [row] = await db
        .insert(oauthApps)
        .values({
          orgId: data.orgId ?? null,
          name: data.name,
          clientId: data.clientId,
          clientSecretHash: data.clientSecretHash ?? null,
          redirectUris: data.redirectUris,
          scopes: data.scopes,
          tokenEndpointAuthMethod: data.tokenEndpointAuthMethod ?? null,
          clientUri: data.clientUri ?? null,
        })
        .returning();
      return mapApp(row!);
    },
    async softDelete(id) {
      await db
        .update(oauthApps)
        .set({ deletedAt: new Date() })
        .where(eq(oauthApps.id, id));
    },
  };
}

export function makeOAuthGrantRepository(db: Db): OAuthGrantRepository {
  return {
    async create(data) {
      const [row] = await db
        .insert(oauthGrants)
        .values({
          oauthAppId: data.oauthAppId,
          orgId: data.orgId,
          userId: data.userId,
          codeHash: data.codeHash,
          codeChallenge: data.codeChallenge,
          codeExpiresAt: data.codeExpiresAt,
          resource: data.resource,
          scopes: data.scopes,
        })
        .returning();
      return mapGrant(row!);
    },
    async findByCodeHash(codeHash) {
      const [row] = await db
        .select()
        .from(oauthGrants)
        .where(and(eq(oauthGrants.codeHash, codeHash), isNull(oauthGrants.revokedAt)))
        .limit(1);
      return row ? mapGrant(row) : null;
    },
    async findByAccessTokenHash(accessTokenHash) {
      const [row] = await db
        .select()
        .from(oauthGrants)
        .where(
          and(eq(oauthGrants.accessTokenHash, accessTokenHash), isNull(oauthGrants.revokedAt)),
        )
        .limit(1);
      return row ? mapGrant(row) : null;
    },
    async findByRefreshTokenHash(refreshTokenHash) {
      const [current] = await db
        .select()
        .from(oauthGrants)
        .where(
          and(eq(oauthGrants.refreshTokenHash, refreshTokenHash), isNull(oauthGrants.revokedAt)),
        )
        .limit(1);
      if (current) return { grant: mapGrant(current), matched: 'current' as const };
      const [previous] = await db
        .select()
        .from(oauthGrants)
        .where(
          and(
            eq(oauthGrants.prevRefreshTokenHash, refreshTokenHash),
            isNull(oauthGrants.revokedAt),
          ),
        )
        .limit(1);
      if (previous) return { grant: mapGrant(previous), matched: 'previous' as const };
      return null;
    },
    async consumeCodeAndIssueTokens(input) {
      const [row] = await db
        .update(oauthGrants)
        .set({
          codeHash: null,
          codeChallenge: null,
          codeExpiresAt: null,
          accessTokenHash: input.accessTokenHash,
          accessTokenExpiresAt: input.accessTokenExpiresAt,
          refreshTokenHash: input.refreshTokenHash,
          prevRefreshTokenHash: null,
        })
        .where(
          and(
            eq(oauthGrants.id, input.grantId),
            isNull(oauthGrants.revokedAt),
            isNotNull(oauthGrants.codeHash),
          ),
        )
        .returning();
      return row ? mapGrant(row) : null;
    },
    async rotateRefresh(input) {
      const [cur] = await db
        .select()
        .from(oauthGrants)
        .where(and(eq(oauthGrants.id, input.grantId), isNull(oauthGrants.revokedAt)))
        .limit(1);
      if (!cur) return null;
      const [row] = await db
        .update(oauthGrants)
        .set({
          prevRefreshTokenHash: cur.refreshTokenHash,
          refreshTokenHash: input.refreshTokenHash,
          accessTokenHash: input.accessTokenHash,
          accessTokenExpiresAt: input.accessTokenExpiresAt,
        })
        .where(and(eq(oauthGrants.id, input.grantId), isNull(oauthGrants.revokedAt)))
        .returning();
      return row ? mapGrant(row) : null;
    },
    async revoke(grantId) {
      await db
        .update(oauthGrants)
        .set({ revokedAt: new Date() })
        .where(eq(oauthGrants.id, grantId));
    },
    async revokeFamily(grantId) {
      await db
        .update(oauthGrants)
        .set({ revokedAt: new Date() })
        .where(eq(oauthGrants.id, grantId));
    },
  };
}
