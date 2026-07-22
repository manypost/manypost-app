import { z } from 'zod';
import type {
  ChannelProvider,
  ProviderContext,
  PublishResult,
  TokenSet,
} from '@manypost/contracts';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/twitch.provider.ts
// (escopos, os dois modos — mensagem no chat × anúncio do canal —, corte em 500 chars, cor do
// anúncio e réplica por reply_parent_message_id). Divergências de propósito: ctx injetado (nada de
// env global), settings tipados por Zod e, principalmente, **a recusa da Twitch vira falha de
// verdade**: o Postiz devolve status 'error' e segue a vida; aqui o `is_sent:false` levanta o
// drop_reason, senão o post apareceria como publicado sem nunca ter entrado no chat.
//
// ⚠️ Chat é ao vivo e efêmero: mensagem agendada para um canal offline vai para uma sala vazia.
// A decisão de manter paridade com o Postiz está registrada em docs/principal/platform-gates.md.

const AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const API_BASE = 'https://api.twitch.tv/helix';
const SCOPES = ['user:write:chat', 'user:read:chat', 'moderator:manage:announcements'];
/** teto de uma mensagem no chat da Twitch */
const MAX_LEN = 500;

const settingsSchema = z.object({
  messageType: z
    .enum(['message', 'announcement'])
    .default('message')
    .describe('Mensagem comum no chat ou anúncio destacado (aparece em realce para todo mundo).'),
  announcementColor: z
    .enum(['primary', 'blue', 'green', 'orange', 'purple'])
    .default('primary')
    .describe('Cor do destaque do anúncio — só tem efeito quando o tipo é anúncio.'),
});

type Settings = z.infer<typeof settingsSchema>;

/** gravado no canal na conexão: o id endereça a Helix, o login monta a URL do canal */
interface ChannelSettings {
  broadcasterId?: string;
  login?: string;
}

/** Toda chamada à Helix leva o Client-Id do app junto do bearer — sem ele a Twitch responde 401. */
const helixHeaders = (ctx: ProviderContext, accessToken: string) => ({
  authorization: `Bearer ${accessToken}`,
  'client-id': ctx.secrets.clientId ?? '',
  'content-type': 'application/json',
});

async function tw<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  return (text ? JSON.parse(text) : {}) as T;
}

interface TwitchTokenBody {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string[] | string;
}

async function oauthToken(ctx: ProviderContext, params: Record<string, string>): Promise<TokenSet> {
  const t = await tw<TwitchTokenBody>(ctx, TOKEN_URL, {
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
    // a Twitch devolve os escopos como ARRAY (as outras redes mandam string separada)
    scopes: Array.isArray(t.scope) ? t.scope : (t.scope?.split(' ').filter(Boolean) ?? []),
  };
}

interface TwitchUser {
  id: string;
  login: string;
  display_name?: string;
  profile_image_url?: string;
}

async function getUser(ctx: ProviderContext, accessToken: string): Promise<TwitchUser> {
  const { data } = await tw<{ data?: TwitchUser[] }>(ctx, `${API_BASE}/users`, {
    headers: helixHeaders(ctx, accessToken),
  });
  const user = data?.[0];
  if (!user?.id) throw { status: 502, body: 'a Twitch não retornou os dados da conta' };
  return user;
}

const releaseUrl = (login?: string) =>
  login ? `https://twitch.tv/${login}` : 'https://twitch.tv/';

/** Anúncio do canal: 204 sem corpo — não existe id de mensagem para devolver. */
async function sendAnnouncement(
  ctx: ProviderContext,
  token: TokenSet,
  broadcasterId: string,
  cfg: Settings,
  message: string,
): Promise<PublishResult> {
  const q = new URLSearchParams({ broadcaster_id: broadcasterId, moderator_id: broadcasterId });
  await tw(ctx, `${API_BASE}/chat/announcements?${q}`, {
    method: 'POST',
    headers: helixHeaders(ctx, token.accessToken),
    body: JSON.stringify({ message: message.slice(0, MAX_LEN), color: cfg.announcementColor }),
  });
  // sem id da rede: geramos um para o nosso registro (réplicas de anúncio não usam parent)
  return { externalId: `announcement:${crypto.randomUUID()}` };
}

interface SentMessage {
  message_id?: string;
  is_sent?: boolean;
  drop_reason?: { code?: string; message?: string };
}

/**
 * Mensagem no chat. A Twitch responde **200 mesmo quando descarta** a mensagem (modo
 * seguidores-only, mensagem duplicada, usuário banido) — `is_sent:false` + `drop_reason`.
 * Tratar isso como sucesso mentiria para o usuário, então vira erro permanente com o motivo.
 */
async function sendChatMessage(
  ctx: ProviderContext,
  token: TokenSet,
  broadcasterId: string,
  message: string,
  replyToMessageId?: string,
): Promise<PublishResult> {
  const { data } = await tw<{ data?: SentMessage[] }>(ctx, `${API_BASE}/chat/messages`, {
    method: 'POST',
    headers: helixHeaders(ctx, token.accessToken),
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id: broadcasterId,
      message: message.slice(0, MAX_LEN),
      ...(replyToMessageId ? { reply_parent_message_id: replyToMessageId } : {}),
    }),
  });
  const sent = data?.[0];
  if (!sent?.is_sent) {
    const reason = sent?.drop_reason;
    throw {
      status: 422,
      body: `a Twitch descartou a mensagem${reason?.message ? `: ${reason.message}` : ''}${
        reason?.code ? ` (${reason.code})` : ''
      }`,
    };
  }
  return { externalId: sent.message_id ?? crypto.randomUUID() };
}

function resolve(rawSettings: unknown): { cfg: Settings; broadcasterId: string; login?: string } {
  const { broadcasterId, login } = (rawSettings ?? {}) as ChannelSettings;
  if (!broadcasterId) {
    throw { status: 422, body: 'canal sem identificação do broadcaster — reconecte a conta da Twitch' };
  }
  return { cfg: settingsSchema.parse(rawSettings ?? {}), broadcasterId, ...(login ? { login } : {}) };
}

export const twitchProvider: ChannelProvider = {
  id: 'twitch',
  name: 'Twitch',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_LEN,
    // chat não carrega anexo: qualquer mídia é recusada no agendamento
    media: {
      images: { maxCount: 0, mimeTypes: [] },
      videos: { maxCount: 0, mimeTypes: [] },
    },
    threads: true, // réplica encadeada no chat (reply_parent_message_id)
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    // Derived from Postiz (AGPL-3.0): maxConcurrentJob = 1. Chat de usuário comum: 20 msg/30s.
    maxConcurrent: 1,
    perChannelWindow: { limit: 20, windowSec: 30 },
  },
  settingsSchema,
  requiredSecrets: ['clientId', 'clientSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: ctx.secrets.clientId ?? '',
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      state,
    });
    return { url: `${AUTHORIZE_URL}?${q}`, state };
  },

  async exchangeCode(ctx, { code, redirectUri }) {
    const set = await oauthToken(ctx, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    if (set.scopes.length > 0 && !set.scopes.includes('user:write:chat')) {
      throw {
        status: 403,
        body: 'permissão de escrever no chat não concedida (user:write:chat) — refaça a conexão',
      };
    }
    const user = await getUser(ctx, set.accessToken);
    return {
      ...set,
      externalId: user.id,
      name: user.display_name || user.login,
      username: user.login,
      ...(user.profile_image_url ? { avatarUrl: user.profile_image_url } : {}),
      // broadcasterId endereça a Helix no publish; login monta a URL do canal
      channelSettings: { broadcasterId: user.id, login: user.login },
    };
  },

  async refreshToken(ctx, refreshToken) {
    return oauthToken(ctx, { grant_type: 'refresh_token', refresh_token: refreshToken });
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    if (!item) return [];
    const { cfg, broadcasterId, login } = resolve(rawSettings);
    const result =
      cfg.messageType === 'announcement'
        ? await sendAnnouncement(ctx, token, broadcasterId, cfg, item.content)
        : await sendChatMessage(ctx, token, broadcasterId, item.content);
    return [{ ...result, releaseUrl: releaseUrl(login) }];
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    const { cfg, broadcasterId, login } = resolve(rawSettings);
    // anúncio não responde a nada: a "réplica" de uma thread de anúncios é outro anúncio
    const result =
      cfg.messageType === 'announcement'
        ? await sendAnnouncement(ctx, token, broadcasterId, cfg, item.content)
        : await sendChatMessage(ctx, token, broadcasterId, item.content, parentExternalId);
    return { ...result, releaseUrl: releaseUrl(login) };
  },

  async validateMedia(items) {
    if (items.some((i) => i.media.length > 0)) {
      return { ok: false, reason: 'o chat da Twitch não aceita imagem nem vídeo' };
    }
    return { ok: true };
  },

  classifyError(status, body) {
    if (status === 401) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    // 403 aqui é escopo/permissão faltando (ex.: não é moderador do canal) — reconectar não resolve
    void body;
    return 'permanent';
  },
};
