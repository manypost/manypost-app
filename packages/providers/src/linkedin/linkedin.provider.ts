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

// Derived from Postiz (AGPL-3.0): direção do linkedin.provider.ts (Posts API versionada,
// initializeUpload de imagem, escape do commentary, comentários via socialActions).
// Implementação própria sobre a API REST do LinkedIn (member post — página fica p/ onda 2).

const AUTH_BASE = 'https://www.linkedin.com/oauth/v2';
const API_BASE = 'https://api.linkedin.com';
/** Versão mensal da API REST do LinkedIn (header LinkedIn-Version). */
const API_VERSION = '202601';
const SCOPES = ['openid', 'profile', 'w_member_social'];
const MAX_LEN = 3000;

const settingsSchema = z.object({
  /** PUBLIC = qualquer pessoa; CONNECTIONS = só conexões do autor */
  visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC'),
});

const versionHeaders = (accessToken: string) => ({
  authorization: `Bearer ${accessToken}`,
  'LinkedIn-Version': API_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
});

async function api<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OAuthTokenBody {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function oauthToken(
  ctx: ProviderContext,
  params: Record<string, string>,
): Promise<OAuthTokenBody> {
  return api<OAuthTokenBody>(ctx, `${AUTH_BASE}/accessToken`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...params,
      client_id: ctx.secrets.clientId ?? '',
      client_secret: ctx.secrets.clientSecret ?? '',
    }),
  });
}

const tokenSetOf = (ctx: ProviderContext, t: OAuthTokenBody): TokenSet => ({
  accessToken: t.access_token,
  ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
  expiresAt: new Date(ctx.now().getTime() + t.expires_in * 1000).toISOString(),
  scopes: t.scope?.split(/[ ,]/).filter(Boolean) ?? [],
});

/** Resolve o membro dono do token (OpenID userinfo) — é o `author` de todo post. */
async function whoAmI(
  ctx: ProviderContext,
  accessToken: string,
): Promise<{ sub: string; name?: string; picture?: string }> {
  return api(ctx, `${API_BASE}/v2/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

// Derived from Postiz (AGPL-3.0): fixText do linkedin.provider.ts — o commentary usa o
// formato "little" do LinkedIn e os caracteres reservados precisam de escape literal.
function escapeCommentary(text: string): string {
  return text.replace(/[\\<>#~_|[\]*(){}@]/g, (c) => `\\${c}`);
}

/**
 * Sobe uma imagem: initializeUpload → PUT dos bytes → espera ficar AVAILABLE.
 * Token de membro (w_member_social) é write-only em /rest/images — o GET de status
 * responde 401/403; nesse caso espera fixa (direção do Postiz) em vez de poll.
 */
async function uploadImage(
  ctx: ProviderContext,
  accessToken: string,
  personUrn: string,
  m: MediaRef,
): Promise<string> {
  const init = await api<{ value: { uploadUrl: string; image: string } }>(
    ctx,
    `${API_BASE}/rest/images?action=initializeUpload`,
    {
      method: 'POST',
      headers: { ...versionHeaders(accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({ initializeUploadRequest: { owner: personUrn } }),
    },
  );

  const src = await ctx.fetch(m.url, { signal: AbortSignal.timeout(60_000) });
  if (!src.ok) throw { status: 422, body: `mídia inacessível para o worker: HTTP ${src.status}` };
  const put = await ctx.fetch(init.value.uploadUrl, {
    method: 'PUT',
    headers: { ...versionHeaders(accessToken), 'content-type': 'application/octet-stream' },
    body: await src.arrayBuffer(),
  });
  if (!put.ok) throw { status: put.status, body: (await put.text()).slice(0, 2000) };

  const urn = init.value.image;
  for (let i = 0; i < 15; i++) {
    const poll = await ctx.fetch(`${API_BASE}/rest/images/${encodeURIComponent(urn)}`, {
      headers: versionHeaders(accessToken),
    });
    if (poll.status === 401 || poll.status === 403) {
      await sleep(10_000); // membro não pode consultar status — dar tempo do processamento
      break;
    }
    if (!poll.ok) throw { status: poll.status, body: (await poll.text()).slice(0, 2000) };
    const { status } = (await poll.json()) as { status?: string };
    if (status === 'AVAILABLE') break;
    if (status === 'PROCESSING_FAILED') {
      throw { status: 422, body: 'o LinkedIn falhou ao processar a imagem' };
    }
    await sleep(2_000);
  }
  return urn;
}

/** content do post: 1 mídia = content.media; 2+ imagens = content.multiImage. */
function contentOf(mediaUrns: Array<{ id: string; altText?: string }>) {
  if (mediaUrns.length === 0) return {};
  if (mediaUrns.length === 1) return { content: { media: mediaUrns[0] } };
  return { content: { multiImage: { images: mediaUrns } } };
}

async function createPost(
  ctx: ProviderContext,
  accessToken: string,
  personUrn: string,
  item: PublishItem,
  visibility: 'PUBLIC' | 'CONNECTIONS',
): Promise<PublishResult> {
  const mediaUrns = [];
  for (const m of item.media) {
    const id = await uploadImage(ctx, accessToken, personUrn, m);
    mediaUrns.push({ id, ...(m.alt ? { altText: m.alt } : {}) });
  }
  const res = await ctx.fetch(`${API_BASE}/rest/posts`, {
    method: 'POST',
    headers: { ...versionHeaders(accessToken), 'content-type': 'application/json' },
    body: JSON.stringify({
      author: personUrn,
      commentary: escapeCommentary(item.content),
      visibility,
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...contentOf(mediaUrns),
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  const postUrn = res.headers.get('x-restli-id');
  if (!postUrn) throw { status: 502, body: 'LinkedIn não devolveu o id do post (x-restli-id)' };
  return { externalId: postUrn, releaseUrl: `https://www.linkedin.com/feed/update/${postUrn}` };
}

/**
 * Comentários encadeiam sempre no post RAIZ (comentário de comentário tem 1 nível só no
 * LinkedIn): se o pai já é um comentário, o alvo é o URN interno dele (a atividade raiz).
 */
const commentTargetOf = (parentExternalId: string): string => {
  const m = parentExternalId.match(/^urn:li:comment:\((.+),[^,)]+\)$/);
  return m?.[1] ?? parentExternalId;
};

async function createComment(
  ctx: ProviderContext,
  accessToken: string,
  personUrn: string,
  parentExternalId: string,
  item: PublishItem,
): Promise<PublishResult> {
  const target = commentTargetOf(parentExternalId);
  const res = await api<{ commentUrn?: string; object?: string }>(
    ctx,
    `${API_BASE}/rest/socialActions/${encodeURIComponent(target)}/comments`,
    {
      method: 'POST',
      headers: { ...versionHeaders(accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({
        actor: personUrn,
        object: target,
        message: { text: escapeCommentary(item.content) },
      }),
    },
  );
  return {
    externalId: res.commentUrn ?? target,
    releaseUrl: `https://www.linkedin.com/feed/update/${target}`,
  };
}

export const linkedinProvider: ChannelProvider = {
  id: 'linkedin',
  name: 'LinkedIn',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_LEN,
    media: {
      // multiImage aceita 2–20 imagens; 1 imagem vai em content.media. Sem transformação
      // de formato no worker → só os MIMEs que a Images API aceita nativamente.
      images: { maxCount: 20, mimeTypes: ['image/jpeg', 'image/png', 'image/gif'] },
      // vídeo exige upload em partes + finalizeUpload + poll de processamento — onda 2
      videos: { maxCount: 0, mimeTypes: [] },
    },
    threads: true, // réplicas viram comentários no post raiz
    mentions: false,
    analytics: false,
    twoStepConnect: false, // página (organization) fica p/ onda 2 como provider linkedin-page
    customInstance: false,
  },
  rateDefaults: {
    maxConcurrent: 2,
    // membro tem teto diário (~150 chamadas de criação/dia) — publicar bem abaixo
    perChannelWindow: { limit: 100, windowSec: 86_400 },
  },
  settingsSchema,
  requiredSecrets: ['clientId', 'clientSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: ctx.secrets.clientId ?? '',
      redirect_uri: redirectUri,
      state,
      scope: SCOPES.join(' '),
    });
    return { url: `${AUTH_BASE}/authorization?${q}`, state };
  },

  async exchangeCode(ctx, { code, redirectUri }) {
    const token = await oauthToken(ctx, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const set = tokenSetOf(ctx, token);
    if (!set.scopes.includes('w_member_social')) {
      throw { status: 403, body: 'permissão w_member_social não concedida — refaça a autorização marcando todas as permissões' };
    }
    const me = await whoAmI(ctx, set.accessToken);
    return {
      ...set,
      externalId: me.sub,
      name: me.name ?? 'LinkedIn',
      ...(me.picture ? { avatarUrl: me.picture } : {}),
    };
  },

  // Só funciona em apps com refresh token programático habilitado (parceria LinkedIn).
  // Sem refresh_token guardado o worker nem chega aqui: marca REFRESH_REQUIRED direto.
  async refreshToken(ctx, refreshToken) {
    return tokenSetOf(ctx, await oauthToken(ctx, { grant_type: 'refresh_token', refresh_token: refreshToken }));
  },

  async publish(ctx, token, items, rawSettings) {
    const { visibility } = settingsSchema.parse(rawSettings ?? {});
    const me = await whoAmI(ctx, token.accessToken);
    const personUrn = `urn:li:person:${me.sub}`;

    const results: PublishResult[] = [];
    let parent: string | undefined;
    for (const item of items) {
      const res = parent
        ? await createComment(ctx, token.accessToken, personUrn, parent, item)
        : await createPost(ctx, token.accessToken, personUrn, item, visibility);
      parent = parent ?? res.externalId;
      results.push(res);
    }
    return results;
  },

  async publishReply(ctx, token, parentExternalId, item) {
    const me = await whoAmI(ctx, token.accessToken);
    return createComment(ctx, token.accessToken, `urn:li:person:${me.sub}`, parentExternalId, item);
  },

  async validateMedia(items) {
    // comentários (itens 1+) só aceitam texto na API do LinkedIn
    if (items.slice(1).some((i) => i.media.length > 0)) {
      return { ok: false, reason: 'no LinkedIn, réplicas da thread viram comentários e não aceitam mídia' };
    }
    return checkMediaRules(items, linkedinProvider.capabilities.media);
  },

  classifyError(status, body) {
    if (status === 401) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    // instabilidades conhecidas da API que se resolvem em retry (direção do Postiz)
    if (/Unable to obtain activity|resource is forbidden|Service Unavailable/i.test(body)) {
      return 'transient';
    }
    return 'permanent';
  },
};
