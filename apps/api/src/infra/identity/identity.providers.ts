import type { Env } from '@manypost/config';
import type { SocialProfile } from '@manypost/core';

/** Provedor de LOGIN social (≠ ChannelProvider, que é canal de publicação). */
export interface IdentityProvider {
  id: string;
  name: string;
  authUrl(redirectUri: string, state: string): string;
  exchange(code: string, redirectUri: string): Promise<SocialProfile>;
}

function makeGoogle(clientId: string, clientSecret: string): IdentityProvider {
  return {
    id: 'google',
    name: 'Google',
    authUrl(redirectUri, state) {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
    },
    async exchange(code, redirectUri) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!res.ok) throw new Error(`google token: ${res.status}`);
      const { id_token } = (await res.json()) as { id_token?: string };
      if (!id_token) throw new Error('google: id_token ausente');
      // id_token veio direto do endpoint de token do Google via TLS — decodificação direta
      const payload = JSON.parse(
        Buffer.from(id_token.split('.')[1]!, 'base64url').toString('utf8'),
      ) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      };
      return {
        provider: 'google',
        providerUserId: payload.sub,
        email: payload.email ?? '',
        emailVerified: payload.email_verified === true,
        name: payload.name ?? null,
        avatarUrl: payload.picture ?? null,
      };
    },
  };
}

function makeGithub(clientId: string, clientSecret: string): IdentityProvider {
  return {
    id: 'github',
    name: 'GitHub',
    authUrl(redirectUri, state) {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'read:user user:email',
        state,
      });
      return `https://github.com/login/oauth/authorize?${q}`;
    },
    async exchange(code, redirectUri) {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
      });
      if (!tokenRes.ok) throw new Error(`github token: ${tokenRes.status}`);
      const { access_token } = (await tokenRes.json()) as { access_token?: string };
      if (!access_token) throw new Error('github: access_token ausente');

      const gh = {
        authorization: `Bearer ${access_token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'manypost',
      };
      const user = (await (await fetch('https://api.github.com/user', { headers: gh })).json()) as {
        id: number;
        login: string;
        name: string | null;
        avatar_url: string | null;
      };
      const emails = (await (
        await fetch('https://api.github.com/user/emails', { headers: gh })
      ).json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const best =
        emails.find?.((e) => e.primary && e.verified) ?? emails.find?.((e) => e.verified) ?? null;

      return {
        provider: 'github',
        providerUserId: String(user.id),
        email: best?.email ?? '',
        emailVerified: best?.verified === true,
        name: user.name ?? user.login,
        avatarUrl: user.avatar_url,
      };
    },
  };
}

/** Só entram no catálogo os provedores com env configurada (mesmo padrão dos canais). */
export function buildIdentityProviders(env: Env): Map<string, IdentityProvider> {
  const map = new Map<string, IdentityProvider>();
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    map.set('google', makeGoogle(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET));
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    map.set('github', makeGithub(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET));
  }
  return map;
}
