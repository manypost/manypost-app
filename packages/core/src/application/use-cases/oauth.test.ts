import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'bun:test';
import {
  OAUTH_ACCESS_PREFIX,
  makeApproveAuthorization,
  makeEnsureStaticMcpClient,
  makeExchangeAuthorizationCode,
  makeRefreshOAuthToken,
  makeRegisterPublicClient,
  makeVerifyOAuthAccessToken,
  pkceChallengeS256,
  redirectUriAllowed,
} from './oauth';
import type { OAuthAppRecord, OAuthGrantRecord } from '../ports/oauth';
import { randomToken, sha256Hex } from '../tokens';

function makeOAuthFakes() {
  const apps: OAuthAppRecord[] = [];
  const grants: OAuthGrantRecord[] = [];
  let seq = 0;
  const id = () => `oauth-${++seq}`;

  const appsRepo = {
    findByClientId: async (clientId: string) =>
      apps.find((a) => a.clientId === clientId && !a.deletedAt) ?? null,
    create: async (data: {
      orgId?: string | null;
      name: string;
      clientId: string;
      clientSecretHash?: string | null;
      redirectUris: string[];
      scopes: string[];
      tokenEndpointAuthMethod?: string | null;
      clientUri?: string | null;
    }) => {
      const row: OAuthAppRecord = {
        id: id(),
        orgId: data.orgId ?? null,
        name: data.name,
        clientId: data.clientId,
        clientSecretHash: data.clientSecretHash ?? null,
        redirectUris: data.redirectUris,
        scopes: data.scopes,
        tokenEndpointAuthMethod: data.tokenEndpointAuthMethod ?? 'none',
        clientUri: data.clientUri ?? null,
        deletedAt: null,
        createdAt: new Date(),
      };
      apps.push(row);
      return row;
    },
    softDelete: async (appId: string) => {
      const row = apps.find((a) => a.id === appId);
      if (row) row.deletedAt = new Date();
    },
    updateRedirectUris: async (appId: string, redirectUris: string[]) => {
      const row = apps.find((a) => a.id === appId && !a.deletedAt);
      if (!row) return null;
      row.redirectUris = redirectUris;
      return row;
    },
  };

  const grantsRepo = {
    create: async (data: {
      oauthAppId: string;
      orgId: string;
      userId: string;
      codeHash: string;
      codeChallenge: string;
      codeExpiresAt: Date;
      resource: string | null;
      scopes: string[];
    }) => {
      const row: OAuthGrantRecord = {
        id: id(),
        oauthAppId: data.oauthAppId,
        orgId: data.orgId,
        userId: data.userId,
        codeHash: data.codeHash,
        codeChallenge: data.codeChallenge,
        codeExpiresAt: data.codeExpiresAt,
        accessTokenHash: null,
        accessTokenExpiresAt: null,
        refreshTokenHash: null,
        prevRefreshTokenHash: null,
        resource: data.resource,
        scopes: data.scopes,
        revokedAt: null,
        createdAt: new Date(),
      };
      grants.push(row);
      return row;
    },
    findByCodeHash: async (codeHash: string) =>
      grants.find((g) => g.codeHash === codeHash && !g.revokedAt) ?? null,
    findByAccessTokenHash: async (accessTokenHash: string) =>
      grants.find((g) => g.accessTokenHash === accessTokenHash && !g.revokedAt) ?? null,
    findByRefreshTokenHash: async (refreshTokenHash: string) => {
      const current = grants.find(
        (g) => g.refreshTokenHash === refreshTokenHash && !g.revokedAt,
      );
      if (current) return { grant: current, matched: 'current' as const };
      const previous = grants.find(
        (g) => g.prevRefreshTokenHash === refreshTokenHash && !g.revokedAt,
      );
      if (previous) return { grant: previous, matched: 'previous' as const };
      return null;
    },
    consumeCodeAndIssueTokens: async (input: {
      grantId: string;
      accessTokenHash: string;
      accessTokenExpiresAt: Date;
      refreshTokenHash: string;
    }) => {
      const g = grants.find((row) => row.id === input.grantId && !row.revokedAt);
      if (!g || !g.codeHash) return null;
      g.codeHash = null;
      g.codeChallenge = null;
      g.codeExpiresAt = null;
      g.accessTokenHash = input.accessTokenHash;
      g.accessTokenExpiresAt = input.accessTokenExpiresAt;
      g.refreshTokenHash = input.refreshTokenHash;
      g.prevRefreshTokenHash = null;
      return g;
    },
    rotateRefresh: async (input: {
      grantId: string;
      accessTokenHash: string;
      accessTokenExpiresAt: Date;
      refreshTokenHash: string;
    }) => {
      const g = grants.find((row) => row.id === input.grantId && !row.revokedAt);
      if (!g) return null;
      g.prevRefreshTokenHash = g.refreshTokenHash;
      g.refreshTokenHash = input.refreshTokenHash;
      g.accessTokenHash = input.accessTokenHash;
      g.accessTokenExpiresAt = input.accessTokenExpiresAt;
      return g;
    },
    revoke: async (grantId: string) => {
      const g = grants.find((row) => row.id === grantId);
      if (g) g.revokedAt = new Date();
    },
    revokeFamily: async (grantId: string) => {
      const g = grants.find((row) => row.id === grantId);
      if (g) g.revokedAt = new Date();
    },
  };

  return { apps: appsRepo, grants: grantsRepo, appsStore: apps, grantsStore: grants };
}

describe('MCP OAuth grant lifecycle', () => {
  let fakes: ReturnType<typeof makeOAuthFakes>;

  beforeEach(() => {
    fakes = makeOAuthFakes();
  });

  test('approve + PKCE exchange issues mpo_ access token bound to org', async () => {
    const ensure = makeEnsureStaticMcpClient({ apps: fakes.apps });
    const app = await ensure();
    const verifier = randomToken(32);
    const challenge = pkceChallengeS256(verifier);
    const approve = makeApproveAuthorization({ apps: fakes.apps, grants: fakes.grants });
    const { code } = await approve({
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeChallenge: challenge,
      userId: 'user-1',
      orgId: 'org-1',
      scopes: ['mcp:read', 'mcp:write'],
      resource: 'https://mcp.example/mcp',
    });
    const exchange = makeExchangeAuthorizationCode({ apps: fakes.apps, grants: fakes.grants });
    const tokens = await exchange({
      code,
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeVerifier: verifier,
    });
    expect(tokens.accessToken.startsWith(OAUTH_ACCESS_PREFIX)).toBe(true);
    expect(tokens.refreshToken.length).toBeGreaterThan(20);
    expect(tokens.scopes).toEqual(['mcp:read', 'mcp:write']);

    const verify = makeVerifyOAuthAccessToken({ grants: fakes.grants });
    const principal = await verify(tokens.accessToken);
    expect(principal).toEqual({
      orgId: 'org-1',
      userId: 'user-1',
      scopes: ['mcp:read', 'mcp:write'],
      grantId: expect.any(String),
    });
  });

  test('wrong code_verifier fails and code is not reusable', async () => {
    const ensure = makeEnsureStaticMcpClient({ apps: fakes.apps });
    const app = await ensure();
    const verifier = randomToken(32);
    const approve = makeApproveAuthorization({ apps: fakes.apps, grants: fakes.grants });
    const { code } = await approve({
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeChallenge: pkceChallengeS256(verifier),
      userId: 'user-1',
      orgId: 'org-1',
      scopes: ['mcp:read'],
      resource: null,
    });
    const exchange = makeExchangeAuthorizationCode({ apps: fakes.apps, grants: fakes.grants });
    await expect(
      exchange({
        code,
        clientId: app.clientId,
        redirectUri: app.redirectUris[0]!,
        codeVerifier: 'wrong-verifier-value-here',
      }),
    ).rejects.toThrow();
    await expect(
      exchange({
        code,
        clientId: app.clientId,
        redirectUri: app.redirectUris[0]!,
        codeVerifier: verifier,
      }),
    ).rejects.toThrow();
  });

  test('refresh rotates and reuse of previous refresh revokes family', async () => {
    const ensure = makeEnsureStaticMcpClient({ apps: fakes.apps });
    const app = await ensure();
    const verifier = randomToken(32);
    const approve = makeApproveAuthorization({ apps: fakes.apps, grants: fakes.grants });
    const { code } = await approve({
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeChallenge: pkceChallengeS256(verifier),
      userId: 'user-1',
      orgId: 'org-1',
      scopes: ['mcp:write'],
      resource: null,
    });
    const exchange = makeExchangeAuthorizationCode({ apps: fakes.apps, grants: fakes.grants });
    const first = await exchange({
      code,
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeVerifier: verifier,
    });
    const refresh = makeRefreshOAuthToken({ grants: fakes.grants });
    const second = await refresh({ refreshToken: first.refreshToken });
    expect(second.accessToken).not.toBe(first.accessToken);
    await expect(refresh({ refreshToken: first.refreshToken })).rejects.toThrow();
    const verify = makeVerifyOAuthAccessToken({ grants: fakes.grants });
    expect(await verify(second.accessToken)).toBeNull();
  });

  test('expired or revoked access token does not authenticate', async () => {
    const ensure = makeEnsureStaticMcpClient({ apps: fakes.apps });
    const app = await ensure();
    const verifier = randomToken(32);
    const approve = makeApproveAuthorization({ apps: fakes.apps, grants: fakes.grants });
    const { code, grantId } = await approve({
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeChallenge: pkceChallengeS256(verifier),
      userId: 'user-1',
      orgId: 'org-1',
      scopes: ['mcp:read'],
      resource: null,
    });
    const exchange = makeExchangeAuthorizationCode({
      apps: fakes.apps,
      grants: fakes.grants,
      accessTokenTtlSeconds: -1,
    });
    const tokens = await exchange({
      code,
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeVerifier: verifier,
    });
    const verify = makeVerifyOAuthAccessToken({ grants: fakes.grants });
    expect(await verify(tokens.accessToken)).toBeNull();

    const approve2 = makeApproveAuthorization({ apps: fakes.apps, grants: fakes.grants });
    const verifier2 = randomToken(32);
    const again = await approve2({
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeChallenge: pkceChallengeS256(verifier2),
      userId: 'user-1',
      orgId: 'org-1',
      scopes: ['mcp:read'],
      resource: null,
    });
    const live = await makeExchangeAuthorizationCode({ apps: fakes.apps, grants: fakes.grants })({
      code: again.code,
      clientId: app.clientId,
      redirectUri: app.redirectUris[0]!,
      codeVerifier: verifier2,
    });
    await fakes.grants.revoke(again.grantId);
    expect(await verify(live.accessToken)).toBeNull();
    void grantId;
  });

  test('DCR registers a public client usable for authorize', async () => {
    const register = makeRegisterPublicClient({ apps: fakes.apps });
    const registered = await register({
      redirectUris: ['http://127.0.0.1:54321/callback'],
      clientName: 'cursor-test',
    });
    expect(registered.clientId).toBeTruthy();
    const verifier = randomToken(32);
    const approve = makeApproveAuthorization({ apps: fakes.apps, grants: fakes.grants });
    const { code } = await approve({
      clientId: registered.clientId,
      redirectUri: 'http://127.0.0.1:54321/callback',
      codeChallenge: pkceChallengeS256(verifier),
      userId: 'user-1',
      orgId: 'org-9',
      scopes: ['mcp:read'],
      resource: null,
    });
    const tokens = await makeExchangeAuthorizationCode({
      apps: fakes.apps,
      grants: fakes.grants,
    })({
      code,
      clientId: registered.clientId,
      redirectUri: 'http://127.0.0.1:54321/callback',
      codeVerifier: verifier,
    });
    expect(tokens.accessToken.startsWith(OAUTH_ACCESS_PREFIX)).toBe(true);
  });
});

describe('pkceChallengeS256', () => {
  test('matches RFC 7636 S256', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier, 'ascii').digest('base64url');
    expect(pkceChallengeS256(verifier)).toBe(expected);
  });
});

describe('RFC 8252 loopback redirect matching', () => {
  test('accepts portless loopback registration with ephemeral port', () => {
    expect(
      redirectUriAllowed(['http://127.0.0.1/callback'], 'http://127.0.0.1:53092/callback'),
    ).toBe(true);
    expect(
      redirectUriAllowed(['http://localhost/callback'], 'http://localhost:3118/callback'),
    ).toBe(true);
  });

  test('accepts OpenCode path with ephemeral port on static allowlist', () => {
    expect(
      redirectUriAllowed(
        ['http://127.0.0.1/mcp/oauth/callback'],
        'http://127.0.0.1:19876/mcp/oauth/callback',
      ),
    ).toBe(true);
  });

  test('rejects different loopback path', () => {
    expect(
      redirectUriAllowed(['http://127.0.0.1/callback'], 'http://127.0.0.1:19876/mcp/oauth/callback'),
    ).toBe(false);
  });

  test('keeps exact match for non-loopback URIs', () => {
    expect(
      redirectUriAllowed(
        ['https://cursor.com/api/mcp/auth/callback'],
        'https://cursor.com/api/mcp/auth/callback',
      ),
    ).toBe(true);
    expect(
      redirectUriAllowed(
        ['https://cursor.com/api/mcp/auth/callback'],
        'https://cursor.com/api/mcp/auth/other',
      ),
    ).toBe(false);
    expect(
      redirectUriAllowed(
        ['cursor://anysphere.cursor-mcp/oauth/callback'],
        'cursor://anysphere.cursor-mcp/oauth/callback',
      ),
    ).toBe(true);
  });

  test('DCR client can authorize with a different loopback port than registered', async () => {
    const local = makeOAuthFakes();
    const register = makeRegisterPublicClient({ apps: local.apps });
    const registered = await register({
      redirectUris: ['http://127.0.0.1:33418/'],
      clientName: 'vscode-like',
    });
    const verifier = randomToken(32);
    const approve = makeApproveAuthorization({ apps: local.apps, grants: local.grants });
    const { code } = await approve({
      clientId: registered.clientId,
      redirectUri: 'http://127.0.0.1:59656/',
      codeChallenge: pkceChallengeS256(verifier),
      userId: 'user-1',
      orgId: 'org-1',
      scopes: ['mcp:read'],
      resource: null,
    });
    expect(code.length).toBeGreaterThan(10);
  });
});

describe('static MCP client seed upsert', () => {
  test('merges missing OpenCode redirects into an existing row', async () => {
    const local = makeOAuthFakes();
    await local.apps.create({
      orgId: null,
      name: 'manypost MCP',
      clientId: 'manypost-mcp',
      clientSecretHash: null,
      redirectUris: [
        'cursor://anysphere.cursor-mcp/oauth/callback',
        'https://cursor.com/api/mcp/auth/callback',
      ],
      scopes: ['mcp:read', 'mcp:write'],
      tokenEndpointAuthMethod: 'none',
    });
    const ensure = makeEnsureStaticMcpClient({ apps: local.apps });
    const app = await ensure();
    expect(app.redirectUris).toContain('http://127.0.0.1/mcp/oauth/callback');
    expect(app.redirectUris).toContain('http://localhost/mcp/oauth/callback');
    expect(app.redirectUris).toContain('cursor://anysphere.cursor-mcp/oauth/callback');
  });
});
