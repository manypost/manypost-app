/** Ports do Authorization Server MCP (oauth_apps / oauth_grants). */

export interface OAuthAppRecord {
  id: string;
  orgId: string | null;
  name: string;
  clientId: string;
  clientSecretHash: string | null;
  redirectUris: string[];
  scopes: string[];
  tokenEndpointAuthMethod: string | null;
  clientUri: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface OAuthGrantRecord {
  id: string;
  oauthAppId: string;
  orgId: string;
  userId: string;
  codeHash: string | null;
  codeChallenge: string | null;
  codeExpiresAt: Date | null;
  accessTokenHash: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenHash: string | null;
  prevRefreshTokenHash: string | null;
  resource: string | null;
  scopes: string[];
  revokedAt: Date | null;
  createdAt: Date;
}

export interface OAuthAppRepository {
  findByClientId(clientId: string): Promise<OAuthAppRecord | null>;
  create(data: {
    orgId?: string | null;
    name: string;
    clientId: string;
    clientSecretHash?: string | null;
    redirectUris: string[];
    scopes: string[];
    tokenEndpointAuthMethod?: string | null;
    clientUri?: string | null;
  }): Promise<OAuthAppRecord>;
  softDelete(id: string): Promise<void>;
}

export interface OAuthGrantRepository {
  create(data: {
    oauthAppId: string;
    orgId: string;
    userId: string;
    codeHash: string;
    codeChallenge: string;
    codeExpiresAt: Date;
    resource: string | null;
    scopes: string[];
  }): Promise<OAuthGrantRecord>;
  findByCodeHash(codeHash: string): Promise<OAuthGrantRecord | null>;
  findByAccessTokenHash(accessTokenHash: string): Promise<OAuthGrantRecord | null>;
  findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<{ grant: OAuthGrantRecord; matched: 'current' | 'previous' } | null>;
  consumeCodeAndIssueTokens(input: {
    grantId: string;
    accessTokenHash: string;
    accessTokenExpiresAt: Date;
    refreshTokenHash: string;
  }): Promise<OAuthGrantRecord | null>;
  rotateRefresh(input: {
    grantId: string;
    accessTokenHash: string;
    accessTokenExpiresAt: Date;
    refreshTokenHash: string;
  }): Promise<OAuthGrantRecord | null>;
  revoke(grantId: string): Promise<void>;
  revokeFamily(grantId: string): Promise<void>;
}
