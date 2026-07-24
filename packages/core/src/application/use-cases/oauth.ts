import { createHash } from 'node:crypto';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { OAuthAppRepository, OAuthGrantRepository } from '../ports/oauth';
import { randomToken, sha256Hex } from '../tokens';

export const OAUTH_ACCESS_PREFIX = 'mpo_';
export const STATIC_MCP_CLIENT_ID = 'manypost-mcp';
export const STATIC_MCP_CLIENT_NAME = 'manypost MCP';

/** Redirects conhecidos do Cursor (static client / docs). */
export const STATIC_MCP_REDIRECT_URIS = [
  'cursor://anysphere.cursor-mcp/oauth/callback',
  'https://cursor.com/api/mcp/auth/callback',
] as const;

const CODE_TTL_MS = 5 * 60_000;
const DEFAULT_ACCESS_TTL_SEC = 3600;

export function pkceChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

function assertRedirectAllowed(redirectUris: string[], redirectUri: string): void {
  if (!redirectUris.includes(redirectUri)) {
    throw new DomainError(ErrorCodes.Forbidden, 'redirect_uri não registrado');
  }
}

function normalizeScopes(scopes: string[]): string[] {
  const allowed = new Set(['mcp:read', 'mcp:write']);
  const out = [...new Set(scopes.filter((s) => allowed.has(s)))];
  if (out.length === 0) {
    throw new DomainError(ErrorCodes.Forbidden, 'escopo MCP inválido');
  }
  return out;
}

export interface OAuthAsDeps {
  apps: OAuthAppRepository;
  grants: OAuthGrantRepository;
  accessTokenTtlSeconds?: number;
}

export const makeEnsureStaticMcpClient = (deps: Pick<OAuthAsDeps, 'apps'>) =>
  async () => {
    const existing = await deps.apps.findByClientId(STATIC_MCP_CLIENT_ID);
    if (existing) return existing;
    return deps.apps.create({
      orgId: null,
      name: STATIC_MCP_CLIENT_NAME,
      clientId: STATIC_MCP_CLIENT_ID,
      clientSecretHash: null,
      redirectUris: [...STATIC_MCP_REDIRECT_URIS],
      scopes: ['mcp:read', 'mcp:write'],
      tokenEndpointAuthMethod: 'none',
    });
  };

export const makeRegisterPublicClient = (deps: Pick<OAuthAsDeps, 'apps'>) =>
  async (input: { redirectUris: string[]; clientName?: string }) => {
    if (!input.redirectUris.length) {
      throw new DomainError(ErrorCodes.Forbidden, 'redirect_uris obrigatório');
    }
    for (const uri of input.redirectUris) {
      let parsed: URL;
      try {
        parsed = new URL(uri);
      } catch {
        throw new DomainError(ErrorCodes.Forbidden, 'redirect_uri inválido');
      }
      if (!['http:', 'https:', 'cursor:'].includes(parsed.protocol)) {
        throw new DomainError(ErrorCodes.Forbidden, 'redirect_uri com scheme não suportado');
      }
    }
    const clientId = `dcr_${randomToken(16)}`;
    const app = await deps.apps.create({
      orgId: null,
      name: input.clientName?.trim() || 'MCP client',
      clientId,
      clientSecretHash: null,
      redirectUris: input.redirectUris,
      scopes: ['mcp:read', 'mcp:write'],
      tokenEndpointAuthMethod: 'none',
    });
    return {
      clientId: app.clientId,
      clientIdIssuedAt: Math.floor(app.createdAt.getTime() / 1000),
      tokenEndpointAuthMethod: 'none' as const,
      redirectUris: app.redirectUris,
      grantTypes: ['authorization_code', 'refresh_token'],
      responseTypes: ['code'],
      codeChallengeMethodsSupported: ['S256'],
    };
  };

export const makeApproveAuthorization = (deps: Pick<OAuthAsDeps, 'apps' | 'grants'>) =>
  async (input: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    userId: string;
    orgId: string;
    scopes: string[];
    resource: string | null;
  }) => {
    const app = await deps.apps.findByClientId(input.clientId);
    if (!app) throw new DomainError(ErrorCodes.NotFound, 'client_id desconhecido');
    assertRedirectAllowed(app.redirectUris, input.redirectUri);
    if (!input.codeChallenge.trim()) {
      throw new DomainError(ErrorCodes.Forbidden, 'code_challenge obrigatório');
    }
    const scopes = normalizeScopes(input.scopes);
    const code = randomToken(32);
    const grant = await deps.grants.create({
      oauthAppId: app.id,
      orgId: input.orgId,
      userId: input.userId,
      codeHash: sha256Hex(code),
      codeChallenge: input.codeChallenge,
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      resource: input.resource,
      scopes,
    });
    return { code, grantId: grant.id, scopes };
  };

export const makeExchangeAuthorizationCode = (deps: OAuthAsDeps) =>
  async (input: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
  }) => {
    const app = await deps.apps.findByClientId(input.clientId);
    if (!app) throw new DomainError(ErrorCodes.AuthUnauthorized, 'client_id inválido');
    assertRedirectAllowed(app.redirectUris, input.redirectUri);

    const grant = await deps.grants.findByCodeHash(sha256Hex(input.code));
    if (!grant || grant.oauthAppId !== app.id) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'authorization code inválido');
    }
    if (!grant.codeExpiresAt || grant.codeExpiresAt.getTime() < Date.now()) {
      await deps.grants.revoke(grant.id);
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'authorization code expirado');
    }
    if (!grant.codeChallenge || pkceChallengeS256(input.codeVerifier) !== grant.codeChallenge) {
      await deps.grants.revoke(grant.id);
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'PKCE inválido');
    }

    const accessTtl = deps.accessTokenTtlSeconds ?? DEFAULT_ACCESS_TTL_SEC;
    const accessToken = `${OAUTH_ACCESS_PREFIX}${randomToken(32)}`;
    const refreshToken = randomToken(32);
    const updated = await deps.grants.consumeCodeAndIssueTokens({
      grantId: grant.id,
      accessTokenHash: sha256Hex(accessToken),
      accessTokenExpiresAt: new Date(Date.now() + accessTtl * 1000),
      refreshTokenHash: sha256Hex(refreshToken),
    });
    if (!updated) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'authorization code inválido');
    }
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: accessTtl,
      scopes: updated.scopes,
      grantId: updated.id,
      orgId: updated.orgId,
    };
  };

export const makeRefreshOAuthToken = (deps: Pick<OAuthAsDeps, 'grants'> & {
  accessTokenTtlSeconds?: number;
}) =>
  async (input: { refreshToken: string }) => {
    const found = await deps.grants.findByRefreshTokenHash(sha256Hex(input.refreshToken));
    if (!found) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'refresh token inválido');
    }
    if (found.matched === 'previous') {
      await deps.grants.revokeFamily(found.grant.id);
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'refresh token reutilizado');
    }
    const accessTtl = deps.accessTokenTtlSeconds ?? DEFAULT_ACCESS_TTL_SEC;
    const accessToken = `${OAUTH_ACCESS_PREFIX}${randomToken(32)}`;
    const refreshToken = randomToken(32);
    const updated = await deps.grants.rotateRefresh({
      grantId: found.grant.id,
      accessTokenHash: sha256Hex(accessToken),
      accessTokenExpiresAt: new Date(Date.now() + accessTtl * 1000),
      refreshTokenHash: sha256Hex(refreshToken),
    });
    if (!updated) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'refresh token inválido');
    }
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: accessTtl,
      scopes: updated.scopes,
      grantId: updated.id,
      orgId: updated.orgId,
    };
  };

export const makeVerifyOAuthAccessToken = (deps: Pick<OAuthAsDeps, 'grants'>) =>
  async (presented: string) => {
    if (!presented.startsWith(OAUTH_ACCESS_PREFIX)) return null;
    const grant = await deps.grants.findByAccessTokenHash(sha256Hex(presented));
    if (!grant || grant.revokedAt) return null;
    if (!grant.accessTokenExpiresAt || grant.accessTokenExpiresAt.getTime() < Date.now()) {
      return null;
    }
    return {
      orgId: grant.orgId,
      userId: grant.userId,
      scopes: grant.scopes,
      grantId: grant.id,
    };
  };

export const makeResolveOAuthClient = (deps: Pick<OAuthAsDeps, 'apps'>) =>
  async (clientId: string) => deps.apps.findByClientId(clientId);
