import { z } from 'zod';
import type {
  ChannelProvider,
  MediaRef,
  ProviderContext,
  PublishItem,
  PublishResult,
  TokenSet,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

// Derived from Postiz (AGPL-3.0): direção do x.provider.ts (corpo do POST /2/tweets,
// encadeamento de réplicas, limite 280/4000 por verificado). A autenticação diverge de
// propósito: OAuth2 PKCE + upload de mídia v2 (o Postiz usa OAuth 1.0a + upload v1.1).
// Traga-sua-chave (DECISIONS §6): X_CLIENT_ID/X_CLIENT_SECRET vêm do env do self-hoster.

const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
const API_BASE = 'https://api.x.com';
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'];
/** teto de 5MB por APPEND na API — 4MB deixa folga p/ o envelope multipart */
const CHUNK_BYTES = 4 * 1024 * 1024;

// `verified` NÃO entra aqui: é setting do CANAL (preenchido na conexão, lido
// cru pelo maxLength) — no schema viraria um toggle enganoso no composer.
const settingsSchema = z.object({
  replySettings: z
    .enum(['following', 'mentionedUsers', 'subscribers', 'verified'])
    .optional()
    .describe('Quem pode responder — omitido = todo mundo'),
});

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function api<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OAuthTokenBody {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

/** Token endpoint de cliente confidencial: credenciais do app via Basic auth. */
async function oauthToken(
  ctx: ProviderContext,
  params: Record<string, string>,
): Promise<TokenSet> {
  const t = await api<OAuthTokenBody>(ctx, `${API_BASE}/2/oauth2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${btoa(`${ctx.secrets.clientId ?? ''}:${ctx.secrets.clientSecret ?? ''}`)}`,
    },
    body: new URLSearchParams({ ...params, client_id: ctx.secrets.clientId ?? '' }),
  });
  return {
    accessToken: t.access_token,
    // o refresh token do X ROTACIONA a cada uso — o worker persiste o par novo
    ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
    expiresAt: new Date(ctx.now().getTime() + t.expires_in * 1000).toISOString(),
    scopes: t.scope?.split(' ').filter(Boolean) ?? [],
  };
}

const categoryOf = (m: MediaRef): string => {
  if (m.type === 'video') return 'tweet_video';
  return m.mime === 'image/gif' ? 'tweet_gif' : 'tweet_image';
};

/** Upload chunked v2: initialize → append (4MB) → finalize → poll de processamento. */
async function uploadMedia(
  ctx: ProviderContext,
  accessToken: string,
  m: MediaRef,
): Promise<string> {
  const authz = { authorization: `Bearer ${accessToken}` };
  const src = await ctx.fetch(m.url, { signal: AbortSignal.timeout(60_000) });
  if (!src.ok) throw { status: 422, body: `mídia inacessível para o worker: HTTP ${src.status}` };
  const bytes = await src.arrayBuffer();

  const init = await api<{ data: { id: string } }>(
    ctx,
    `${API_BASE}/2/media/upload/initialize`,
    {
      method: 'POST',
      headers: { ...authz, 'content-type': 'application/json' },
      body: JSON.stringify({
        media_type: m.mime ?? (m.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        total_bytes: bytes.byteLength,
        media_category: categoryOf(m),
      }),
    },
  );
  const mediaId = init.data.id;

  for (let seg = 0; seg * CHUNK_BYTES < bytes.byteLength; seg++) {
    const chunk = bytes.slice(seg * CHUNK_BYTES, (seg + 1) * CHUNK_BYTES);
    const form = new FormData();
    form.append('segment_index', String(seg));
    form.append('media', new Blob([chunk]), 'chunk');
    const res = await ctx.fetch(`${API_BASE}/2/media/upload/${mediaId}/append`, {
      method: 'POST',
      headers: authz, // boundary do multipart fica a cargo do runtime
      body: form,
    });
    if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  }

  const fin = await api<{ data: { id: string; processing_info?: { state: string; check_after_secs?: number } } }>(
    ctx,
    `${API_BASE}/2/media/upload/${mediaId}/finalize`,
    { method: 'POST', headers: authz },
  );

  // vídeo/gif processam async — esperar succeeded antes de anexar ao tweet
  let info = fin.data.processing_info;
  for (let i = 0; info && info.state !== 'succeeded'; i++) {
    if (info.state === 'failed') {
      throw { status: 422, body: 'o X falhou ao processar a mídia — verifique formato e duração' };
    }
    if (i >= 40) throw { status: 503, body: 'o X demorou demais processando a mídia' };
    await sleep(Math.min(info.check_after_secs ?? 2, 10) * 1000);
    const poll = await api<{ data: { processing_info?: { state: string; check_after_secs?: number } } }>(
      ctx,
      `${API_BASE}/2/media/upload?command=STATUS&media_id=${mediaId}`,
      { headers: authz },
    );
    info = poll.data.processing_info ?? { state: 'succeeded' };
  }

  if (m.alt) {
    // acessibilidade é melhor esforço: falha no alt não derruba a publicação
    await ctx
      .fetch(`${API_BASE}/2/media/metadata`, {
        method: 'POST',
        headers: { ...authz, 'content-type': 'application/json' },
        body: JSON.stringify({ id: mediaId, metadata: { alt_text: { text: m.alt } } }),
      })
      .then((r) => {
        if (!r.ok) ctx.log('warn', 'x: alt text recusado', { status: r.status });
      })
      .catch(() => ctx.log('warn', 'x: alt text falhou'));
  }
  return mediaId;
}

interface ResolvedSettings {
  replySettings?: 'following' | 'mentionedUsers' | 'subscribers' | 'verified';
  username?: string;
}

/** username/verified vêm do settings do CANAL (merge) — não são settings de publicação. */
function parseSettings(rawSettings: unknown): ResolvedSettings {
  const { username, ...rest } = (rawSettings ?? {}) as { username?: string };
  const { replySettings } = settingsSchema.parse(rest);
  return { ...(replySettings ? { replySettings } : {}), ...(username ? { username } : {}) };
}

async function createTweet(
  ctx: ProviderContext,
  accessToken: string,
  cfg: ResolvedSettings,
  item: PublishItem,
  inReplyTo?: string,
): Promise<PublishResult> {
  const mediaIds = [];
  for (const m of item.media) mediaIds.push(await uploadMedia(ctx, accessToken, m));

  const res = await api<{ data: { id: string } }>(ctx, `${API_BASE}/2/tweets`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: item.content,
      ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}),
      ...(inReplyTo ? { reply: { in_reply_to_tweet_id: inReplyTo } } : {}),
      ...(cfg.replySettings && !inReplyTo ? { reply_settings: cfg.replySettings } : {}),
    }),
  });
  const id = res.data.id;
  return {
    externalId: id,
    // /i/web/status resolve sem saber o handle (fallback p/ canal antigo sem username)
    releaseUrl: cfg.username
      ? `https://x.com/${cfg.username}/status/${id}`
      : `https://x.com/i/web/status/${id}`,
  };
}

export const xProvider: ChannelProvider = {
  id: 'x',
  name: 'X',
  capabilities: {
    editor: 'plain',
    maxLength: (settings) =>
      (settings as { verified?: boolean } | undefined)?.verified ? 4000 : 280,
    media: {
      images: { maxCount: 4, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
      videos: { maxCount: 1, mimeTypes: ['video/mp4'] },
    },
    threads: true,
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    maxConcurrent: 1, // limites do X são rígidos e por app (BYO-key) — nunca paralelizar
    perChannelWindow: { limit: 80, windowSec: 900 },
  },
  settingsSchema,
  requiredSecrets: ['clientId', 'clientSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const codeVerifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
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
      code_verifier: codeVerifier ?? '',
    });
    const me = await api<{
      data: { id: string; name: string; username: string; profile_image_url?: string; verified?: boolean };
    }>(ctx, `${API_BASE}/2/users/me?user.fields=profile_image_url,verified`, {
      headers: { authorization: `Bearer ${set.accessToken}` },
    });
    return {
      ...set,
      externalId: me.data.id,
      name: me.data.name,
      username: me.data.username,
      ...(me.data.profile_image_url ? { avatarUrl: me.data.profile_image_url } : {}),
      // username monta a releaseUrl; verified libera 4000 chars no maxLength
      channelSettings: { username: me.data.username, verified: me.data.verified ?? false },
    };
  },

  async refreshToken(ctx, refreshToken) {
    return oauthToken(ctx, { grant_type: 'refresh_token', refresh_token: refreshToken });
  },

  async publish(ctx, token, items, rawSettings) {
    const cfg = parseSettings(rawSettings);
    const results: PublishResult[] = [];
    let inReplyTo: string | undefined;
    for (const item of items) {
      const res = await createTweet(ctx, token.accessToken, cfg, item, inReplyTo);
      inReplyTo = res.externalId;
      results.push(res);
    }
    return results;
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    return createTweet(ctx, token.accessToken, parseSettings(rawSettings), item, parentExternalId);
  },

  async validateMedia(items) {
    // X: até 4 imagens OU 1 vídeo/gif por tweet, sem misturar
    return checkMediaRules(items, xProvider.capabilities.media);
  },

  classifyError(status, body) {
    if (status === 401 || /Unsupported Authentication/i.test(body)) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
