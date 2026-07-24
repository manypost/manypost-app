import { createHmac } from 'node:crypto';
import { getCookie, setCookie } from 'hono/cookie';
import { machineEndpoints } from '@manypost/config';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError, STATIC_MCP_CLIENT_ID } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { createApp } from '../openapi';

const PENDING_COOKIE = 'mp_oauth_pending';
const PENDING_TTL_SEC = 600;

export interface OAuthPendingRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scopes: string[];
  resource: string | null;
  exp: number;
}

function issuerBase(publicUrl: string): string {
  return publicUrl.replace(/\/+$/, '');
}

function signPending(payload: OAuthPendingRequest, secretHex: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', Buffer.from(secretHex, 'hex')).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function readPending(raw: string | undefined, secretHex: string): OAuthPendingRequest | null {
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(body)
    .digest('base64url');
  if (expected !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthPendingRequest;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function oauthErrorRedirect(
  redirectUri: string,
  error: string,
  state: string | null,
  description?: string,
): string {
  const u = new URL(redirectUri);
  u.searchParams.set('error', error);
  if (description) u.searchParams.set('error_description', description);
  if (state) u.searchParams.set('state', state);
  return u.toString();
}

/**
 * Authorization Server MCP (RFC 8414 + code/PKCE + DCR) montado na origem PUBLIC_URL
 * via rewrite do Next. Consent UI vive em /oauth/consent (Next).
 */
export function oauthAsRoutes(ctn: Container) {
  const app = createApp();
  const issuer = issuerBase(ctn.env.PUBLIC_URL);
  const mcpUrl = machineEndpoints(ctn.env).mcpUrl;
  const secret = ctn.env.ENCRYPTION_KEY;

  // Seed static client once (best-effort)
  void ctn.oauth.ensureStaticClient().catch(() => {});

  app.get('/.well-known/oauth-authorization-server', (c) =>
    c.json({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp:read', 'mcp:write'],
      client_id_metadata_document_supported: true,
    }),
  );

  app.get('/.well-known/oauth-protected-resource', (c) =>
    c.json({
      resource: mcpUrl,
      authorization_servers: [issuer],
      scopes_supported: ['mcp:read', 'mcp:write'],
      bearer_methods_supported: ['header'],
    }),
  );

  // PRM path-aware alias for /mcp resource
  app.get('/.well-known/oauth-protected-resource/mcp', (c) =>
    c.json({
      resource: mcpUrl,
      authorization_servers: [issuer],
      scopes_supported: ['mcp:read', 'mcp:write'],
      bearer_methods_supported: ['header'],
    }),
  );

  app.post('/oauth/register', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      redirect_uris?: string[];
      client_name?: string;
    } | null;
    const registered = await ctn.oauth.registerPublicClient({
      redirectUris: body?.redirect_uris ?? [],
      ...(body?.client_name ? { clientName: body.client_name } : {}),
    });
    return c.json(registered, 201);
  });

  app.get('/oauth/authorize', async (c) => {
    const clientId = c.req.query('client_id') ?? '';
    const redirectUri = c.req.query('redirect_uri') ?? '';
    const responseType = c.req.query('response_type') ?? '';
    const codeChallenge = c.req.query('code_challenge') ?? '';
    const method = c.req.query('code_challenge_method') ?? '';
    const state = c.req.query('state') ?? null;
    const resource = c.req.query('resource') ?? null;
    const scopeRaw = c.req.query('scope') ?? 'mcp:read mcp:write';
    const scopes = scopeRaw.split(/[\s+]+/).filter(Boolean);

    if (responseType !== 'code') {
      return c.text('unsupported_response_type', 400);
    }
    if (method !== 'S256') {
      return c.text('code_challenge_method deve ser S256', 400);
    }

    try {
      const client = await ctn.oauth.resolveClient(clientId);
      if (!client) throw new DomainError(ErrorCodes.NotFound, 'client_id desconhecido');
      if (!client.redirectUris.includes(redirectUri)) {
        throw new DomainError(ErrorCodes.Forbidden, 'redirect_uri não registrado');
      }
    } catch (err) {
      if (redirectUri) {
        const desc = err instanceof DomainError ? err.message : 'invalid_client';
        return c.redirect(oauthErrorRedirect(redirectUri, 'invalid_request', state, desc));
      }
      throw err;
    }

    const pending: OAuthPendingRequest = {
      clientId,
      redirectUri,
      codeChallenge,
      state,
      scopes,
      resource,
      exp: Date.now() + PENDING_TTL_SEC * 1000,
    };
    setCookie(c, PENDING_COOKIE, signPending(pending, secret), {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: PENDING_TTL_SEC,
      secure: issuer.startsWith('https://'),
    });
    const consent = new URL('/oauth/consent', issuer);
    return c.redirect(consent.toString());
  });

  app.get(
    '/oauth/consent/context',
    requireAuth({ authenticateHuman: ctn.auth.authenticateHuman }),
    async (c) => {
      const pending = readPending(getCookie(c, PENDING_COOKIE), secret);
      if (!pending) {
        throw new DomainError(ErrorCodes.AuthUnauthorized, 'pedido OAuth expirado — reinicie no cliente');
      }
      const p = c.get('principal');
      const orgs = await ctn.repos.orgs.listForUser(p.userId!);
      return c.json({
        clientId: pending.clientId,
        scopes: pending.scopes,
        resource: pending.resource,
        staticClientId: STATIC_MCP_CLIENT_ID,
        organizations: orgs.map((o) => ({ id: o.id, name: o.name, role: o.role })),
      });
    },
  );

  app.post(
    '/oauth/consent/approve',
    requireAuth({ authenticateHuman: ctn.auth.authenticateHuman }),
    async (c) => {
      const pending = readPending(getCookie(c, PENDING_COOKIE), secret);
      if (!pending) {
        throw new DomainError(ErrorCodes.AuthUnauthorized, 'pedido OAuth expirado');
      }
      const body = (await c.req.json()) as { orgId?: string; scopes?: string[] };
      const p = c.get('principal');
      const orgs = await ctn.repos.orgs.listForUser(p.userId!);
      const orgId = body.orgId ?? p.orgId;
      if (!orgs.some((o) => o.id === orgId)) {
        throw new DomainError(ErrorCodes.Forbidden, 'organização inválida');
      }
      const { code } = await ctn.oauth.approveAuthorization({
        clientId: pending.clientId,
        redirectUri: pending.redirectUri,
        codeChallenge: pending.codeChallenge,
        userId: p.userId!,
        orgId,
        scopes: body.scopes?.length ? body.scopes : pending.scopes,
        resource: pending.resource,
      });
      setCookie(c, PENDING_COOKIE, '', { path: '/', maxAge: 0 });
      const dest = new URL(pending.redirectUri);
      dest.searchParams.set('code', code);
      if (pending.state) dest.searchParams.set('state', pending.state);
      return c.json({ redirectTo: dest.toString() });
    },
  );

  app.post(
    '/oauth/consent/deny',
    requireAuth({ authenticateHuman: ctn.auth.authenticateHuman }),
    async (c) => {
      const pending = readPending(getCookie(c, PENDING_COOKIE), secret);
      setCookie(c, PENDING_COOKIE, '', { path: '/', maxAge: 0 });
      if (!pending) return c.json({ redirectTo: issuer });
      return c.json({
        redirectTo: oauthErrorRedirect(
          pending.redirectUri,
          'access_denied',
          pending.state,
          'usuário recusou',
        ),
      });
    },
  );

  app.post('/oauth/token', async (c) => {
    const ct = c.req.header('content-type') ?? '';
    const form = ct.includes('application/json')
      ? ((await c.req.json()) as Record<string, string>)
      : Object.fromEntries(new URLSearchParams(await c.req.text()));
    const grantType = form.grant_type;

    if (grantType === 'authorization_code') {
      const tokens = await ctn.oauth.exchangeCode({
        code: form.code ?? '',
        clientId: form.client_id ?? '',
        redirectUri: form.redirect_uri ?? '',
        codeVerifier: form.code_verifier ?? '',
      });
      return c.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
        scope: tokens.scopes.join(' '),
      });
    }

    if (grantType === 'refresh_token') {
      const tokens = await ctn.oauth.refresh({ refreshToken: form.refresh_token ?? '' });
      return c.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
        scope: tokens.scopes.join(' '),
      });
    }

    return c.json({ error: 'unsupported_grant_type' }, 400);
  });

  return app;
}

export function protectedResourceMetadataUrl(mcpUrl: string): string {
  const base = mcpUrl.replace(/\/+$/, '');
  if (base.endsWith('/mcp')) {
    const origin = base.slice(0, -4);
    return `${origin}/.well-known/oauth-protected-resource/mcp`;
  }
  return `${base}/.well-known/oauth-protected-resource`;
}
