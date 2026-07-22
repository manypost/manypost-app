import { z } from 'zod';
import type {
  ChannelProvider,
  ProviderContext,
  PublishResult,
  TokenSet,
} from '@manypost/contracts';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/kick.provider.ts
// (OAuth 2.1 com PKCE S256, escopos, `POST /public/v1/chat` com type:'user', corte em 500 chars e
// réplica por reply_to_message_id). Divergências de propósito: ctx injetado (nada de env global) e
// **a recusa da Kick vira falha de verdade** — o Postiz marca status 'error' e segue; aqui
// `is_sent:false` levanta erro, senão o post ficaria "publicado" sem ter entrado no chat.
//
// ⚠️ Chat é ao vivo e efêmero (mesma ressalva da Twitch — ver docs/principal/platform-gates.md).
// A API pública da Kick é recente e ainda muda com frequência: quebra aqui é esperada.

const AUTHORIZE_URL = 'https://id.kick.com/oauth/authorize';
const TOKEN_URL = 'https://id.kick.com/oauth/token';
const API_BASE = 'https://api.kick.com/public/v1';
const SCOPES = ['chat:write', 'user:read', 'channel:read'];
/** teto de uma mensagem no chat da Kick */
const MAX_LEN = 500;

/** a Kick não tem opções de publicação — o objeto existe para o formulário do composer ficar vazio */
const settingsSchema = z.object({});

/** gravado no canal na conexão: o id endereça a API, o nome monta a URL do canal */
interface ChannelSettings {
  broadcasterUserId?: string;
  username?: string;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function kick<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  return (text ? JSON.parse(text) : {}) as T;
}

interface KickTokenBody {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

async function oauthToken(ctx: ProviderContext, params: Record<string, string>): Promise<TokenSet> {
  const t = await kick<KickTokenBody>(ctx, TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...params,
      client_id: ctx.secrets.clientId ?? '',
      client_secret: ctx.secrets.clientSecret ?? '',
    }),
  });
  return {
    accessToken: t.access_token,
    ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
    ...(t.expires_in
      ? { expiresAt: new Date(ctx.now().getTime() + t.expires_in * 1000).toISOString() }
      : {}),
    scopes: t.scope?.split(' ').filter(Boolean) ?? [],
  };
}

interface KickUser {
  user_id?: number | string;
  name?: string;
  profile_picture?: string;
}

async function getUser(ctx: ProviderContext, accessToken: string): Promise<KickUser> {
  const { data } = await kick<{ data?: KickUser[] | KickUser }>(ctx, `${API_BASE}/users`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  // a API já devolveu tanto lista quanto objeto único nesta rota — aceitar os dois
  const user = Array.isArray(data) ? data[0] : data;
  if (!user?.user_id) throw { status: 502, body: 'a Kick não retornou os dados da conta' };
  return user;
}

const releaseUrl = (username?: string) =>
  username ? `https://kick.com/${username}` : 'https://kick.com/';

/**
 * Mensagem no chat. Como na Twitch, a Kick responde 200 com `is_sent:false` quando descarta
 * (modo lento, chat travado, usuário banido) — tratar como sucesso mentiria para o usuário.
 */
async function sendChatMessage(
  ctx: ProviderContext,
  token: TokenSet,
  broadcasterUserId: string,
  content: string,
  replyToMessageId?: string,
): Promise<PublishResult> {
  const body = await kick<{ data?: { is_sent?: boolean; message_id?: string } }>(
    ctx,
    `${API_BASE}/chat`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'user',
        content: content.slice(0, MAX_LEN),
        broadcaster_user_id: Number(broadcasterUserId),
        ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      }),
    },
  );
  const sent = body.data;
  if (!sent?.is_sent) throw { status: 422, body: 'a Kick descartou a mensagem do chat' };
  return { externalId: sent.message_id ?? crypto.randomUUID() };
}

function resolve(rawSettings: unknown): { broadcasterUserId: string; username?: string } {
  const { broadcasterUserId, username } = (rawSettings ?? {}) as ChannelSettings;
  if (!broadcasterUserId) {
    throw { status: 422, body: 'canal sem identificação do broadcaster — reconecte a conta da Kick' };
  }
  return { broadcasterUserId, ...(username ? { username } : {}) };
}

export const kickProvider: ChannelProvider = {
  id: 'kick',
  name: 'Kick',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_LEN,
    // chat não carrega anexo: qualquer mídia é recusada no agendamento
    media: {
      images: { maxCount: 0, mimeTypes: [] },
      videos: { maxCount: 0, mimeTypes: [] },
    },
    threads: true, // réplica encadeada no chat (reply_to_message_id)
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    // Derived from Postiz (AGPL-3.0): maxConcurrentJob = 3.
    maxConcurrent: 3,
    perChannelWindow: { limit: 20, windowSec: 30 },
  },
  settingsSchema,
  requiredSecrets: ['clientId', 'clientSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    // OAuth 2.1: PKCE é obrigatório na Kick (não é opcional como no fluxo clássico)
    const codeVerifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: ctx.secrets.clientId ?? '',
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      state,
      code_challenge: b64url(new Uint8Array(digest)),
      code_challenge_method: 'S256',
    });
    return { url: `${AUTHORIZE_URL}?${q}`, state, codeVerifier };
  },

  async exchangeCode(ctx, { code, codeVerifier, redirectUri }) {
    const set = await oauthToken(ctx, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    if (set.scopes.length > 0 && !set.scopes.includes('chat:write')) {
      throw {
        status: 403,
        body: 'permissão de escrever no chat não concedida (chat:write) — refaça a conexão',
      };
    }
    const user = await getUser(ctx, set.accessToken);
    const userId = String(user.user_id);
    return {
      ...set,
      externalId: userId,
      name: user.name ?? 'Kick',
      ...(user.name ? { username: user.name } : {}),
      ...(user.profile_picture ? { avatarUrl: user.profile_picture } : {}),
      channelSettings: { broadcasterUserId: userId, ...(user.name ? { username: user.name } : {}) },
    };
  },

  async refreshToken(ctx, refreshToken) {
    return oauthToken(ctx, { grant_type: 'refresh_token', refresh_token: refreshToken });
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    if (!item) return [];
    const { broadcasterUserId, username } = resolve(rawSettings);
    const result = await sendChatMessage(ctx, token, broadcasterUserId, item.content);
    return [{ ...result, releaseUrl: releaseUrl(username) }];
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    const { broadcasterUserId, username } = resolve(rawSettings);
    const result = await sendChatMessage(
      ctx,
      token,
      broadcasterUserId,
      item.content,
      parentExternalId,
    );
    return { ...result, releaseUrl: releaseUrl(username) };
  },

  async validateMedia(items) {
    if (items.some((i) => i.media.length > 0)) {
      return { ok: false, reason: 'o chat da Kick não aceita imagem nem vídeo' };
    }
    return { ok: true };
  },

  classifyError(status) {
    if (status === 401) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
