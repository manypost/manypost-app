import { z } from 'zod';
import type {
  ChannelProvider,
  MediaRef,
  ProviderContext,
  PublishItem,
  TokenSet,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

// Derived from Postiz (AGPL-3.0): direção do mastodon.provider.ts (registro dinâmico
// de app por instância, sem env global). Implementação própria sobre a API v1 do Mastodon.

const SCOPES = 'read write';

const fieldsSchema = z.object({
  // opcional: sem campo, vale ctx.secrets.defaultInstance (env MASTODON_DEFAULT_INSTANCE)
  instance: z
    .string()
    .url()
    .transform((u) => u.replace(/\/+$/, ''))
    .optional()
    .describe('URL da sua instância (ex.: https://mastodon.social) — vazio usa a instância padrão do servidor, se definida'),
});

const settingsSchema = z.object({
  visibility: z
    .enum(['public', 'unlisted', 'private'])
    .default('public')
    .describe('Visibilidade do toot na instância'),
});

interface Extra {
  instance: string;
  clientId: string;
  clientSecret: string;
}

async function api<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  if (!res.ok) {
    throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  }
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Upload de anexos: POST /api/v2/media; 202 = processando → poll GET /api/v1/media/:id (206 = ainda processando). */
async function uploadAttachments(
  ctx: ProviderContext,
  token: TokenSet,
  instance: string,
  media: MediaRef[],
): Promise<string[]> {
  const authz = { authorization: `Bearer ${token.accessToken}` };
  const ids: string[] = [];
  for (const m of media) {
    const src = await ctx.fetch(m.url, { signal: AbortSignal.timeout(60_000) });
    if (!src.ok) {
      throw { status: 422, body: `mídia inacessível para o worker: HTTP ${src.status} em ${m.url}` };
    }
    const form = new FormData();
    form.append('file', await src.blob(), 'media');
    if (m.alt) form.append('description', m.alt);
    const res = await ctx.fetch(`${instance}/api/v2/media`, {
      method: 'POST',
      headers: authz,
      body: form,
    });
    if (!res.ok && res.status !== 202) {
      throw { status: res.status, body: (await res.text()).slice(0, 2000) };
    }
    const att = (await res.json()) as { id: string };
    if (res.status === 202) {
      let done = false;
      for (let i = 0; i < 30 && !done; i++) {
        await sleep(1000);
        const poll = await ctx.fetch(`${instance}/api/v1/media/${att.id}`, { headers: authz });
        if (poll.status === 200) done = true;
        else if (poll.status !== 206) {
          throw { status: poll.status, body: (await poll.text()).slice(0, 2000) };
        }
      }
      // 503 = transient: a instância ainda processa; retry de negócio tenta de novo
      if (!done) throw { status: 503, body: 'instância demorou a processar a mídia' };
    }
    ids.push(att.id);
  }
  return ids;
}

interface ResolvedSettings {
  instance: string;
  visibility: 'public' | 'unlisted' | 'private';
}

function parseSettings(rawSettings: unknown): ResolvedSettings {
  const { instance, ...rest } = (rawSettings ?? {}) as { instance?: string };
  if (!instance) throw { status: 422, body: 'canal sem instância configurada' };
  return { instance, ...settingsSchema.parse(rest) };
}

async function postStatus(
  ctx: ProviderContext,
  token: TokenSet,
  cfg: ResolvedSettings,
  item: PublishItem,
  inReplyTo?: string,
): Promise<{ externalId: string; releaseUrl: string }> {
  const mediaIds = await uploadAttachments(ctx, token, cfg.instance, item.media);
  const status = await api<{ id: string; url: string }>(ctx, `${cfg.instance}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token.accessToken}`,
      'content-type': 'application/json',
      // idempotência nativa da API do Mastodon por tentativa
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      status: item.content,
      visibility: cfg.visibility,
      ...(mediaIds.length > 0 ? { media_ids: mediaIds } : {}),
      ...(inReplyTo ? { in_reply_to_id: inReplyTo } : {}),
    }),
  });
  return { externalId: status.id, releaseUrl: status.url };
}

export const mastodonProvider: ChannelProvider = {
  id: 'mastodon',
  name: 'Mastodon',
  capabilities: {
    editor: 'plain',
    maxLength: () => 500, // padrão das instâncias; limite real da instância na fase de mídia
    media: {
      images: { maxCount: 4, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] },
      videos: { maxCount: 1, mimeTypes: ['video/mp4', 'video/webm'] },
    },
    threads: true,
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: true,
  },
  rateDefaults: {
    maxConcurrent: 5,
    perChannelWindow: { limit: 25, windowSec: 300 }, // instâncias limitam ~300 req/5min; publicar bem menos
  },
  settingsSchema,
  connectionFieldsSchema: fieldsSchema,

  async getAuthUrl(ctx, { redirectUri, fields }) {
    const parsed = fieldsSchema.parse(fields ?? {});
    const instance = parsed.instance ?? ctx.secrets.defaultInstance?.replace(/\/+$/, '');
    if (!instance) {
      throw { status: 422, body: 'informe a URL da instância (ou defina MASTODON_DEFAULT_INSTANCE)' };
    }
    // registro dinâmico do app NA instância do usuário — nada de env global
    const app = await api<{ client_id: string; client_secret: string }>(
      ctx,
      `${instance}/api/v1/apps`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_name: 'manypost',
          redirect_uris: redirectUri,
          scopes: SCOPES,
          website: 'https://github.com/manypost',
        }),
      },
    );
    const state = crypto.randomUUID();
    const q = new URLSearchParams({
      client_id: app.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state,
    });
    const extra: Extra = { instance, clientId: app.client_id, clientSecret: app.client_secret };
    return { url: `${instance}/oauth/authorize?${q}`, state, extra };
  },

  async exchangeCode(ctx, { code, redirectUri, extra }) {
    const { instance, clientId, clientSecret } = extra as Extra;
    const token = await api<{ access_token: string; scope: string }>(ctx, `${instance}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code,
        scope: SCOPES,
      }),
    });
    const me = await api<{
      id: string;
      username: string;
      display_name: string;
      avatar: string;
      url: string;
    }>(ctx, `${instance}/api/v1/accounts/verify_credentials`, {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    return {
      accessToken: token.access_token, // tokens do Mastodon não expiram
      scopes: token.scope?.split(' ') ?? [],
      externalId: `${new URL(instance).hostname}:${me.id}`,
      name: me.display_name || me.username,
      username: me.username,
      avatarUrl: me.avatar,
      channelSettings: { instance },
    };
  },

  async refreshToken() {
    // sem refresh no Mastodon: 401 = token revogado → reconexão manual
    throw new Error('mastodon não emite refresh token');
  },

  async publish(ctx, token: TokenSet, items: PublishItem[], rawSettings) {
    const cfg = parseSettings(rawSettings);
    const results = [];
    let inReplyTo: string | undefined;
    for (const item of items) {
      const res = await postStatus(ctx, token, cfg, item, inReplyTo);
      inReplyTo = res.externalId;
      results.push(res);
    }
    return results;
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    return postStatus(ctx, token, parseSettings(rawSettings), item, parentExternalId);
  },

  async validateMedia(items) {
    // Mastodon: até 4 imagens OU 1 vídeo por status, sem misturar
    return checkMediaRules(items, mastodonProvider.capabilities.media);
  },

  classifyError(status) {
    if (status === 401) return 'refresh-token'; // vira REFRESH_REQUIRED (sem refresh → manual)
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
