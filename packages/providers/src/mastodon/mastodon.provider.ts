import { z } from 'zod';
import type { ChannelProvider, ProviderContext, PublishItem, TokenSet } from '@manypost/contracts';

// Derived from Postiz (AGPL-3.0): direção do mastodon.provider.ts (registro dinâmico
// de app por instância, sem env global). Implementação própria sobre a API v1 do Mastodon.

const SCOPES = 'read write';

const fieldsSchema = z.object({
  instance: z
    .string()
    .url()
    .transform((u) => u.replace(/\/+$/, '')),
});

const settingsSchema = z.object({
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
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
    const { instance } = fieldsSchema.parse(fields);
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
    const { instance, ...rest } = (rawSettings ?? {}) as { instance?: string };
    if (!instance) throw { status: 422, body: 'canal sem instância configurada' };
    const settings = settingsSchema.parse(rest);
    const results = [];
    let inReplyTo: string | undefined;
    for (const item of items) {
      const status = await api<{ id: string; url: string }>(ctx, `${instance}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token.accessToken}`,
          'content-type': 'application/json',
          // idempotência nativa da API do Mastodon por tentativa
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          status: item.content,
          visibility: settings.visibility,
          ...(inReplyTo ? { in_reply_to_id: inReplyTo } : {}),
        }),
      });
      inReplyTo = status.id;
      results.push({ externalId: status.id, releaseUrl: status.url });
    }
    return results;
  },

  async validateMedia() {
    return { ok: true as const }; // regras de mídia entram com o upload (fase de mídia)
  },

  classifyError(status) {
    if (status === 401) return 'refresh-token'; // vira REFRESH_REQUIRED (sem refresh → manual)
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
