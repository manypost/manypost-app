import { z } from 'zod';
import type {
  ChannelProvider,
  ProviderContext,
  PublishItem,
  PublishResult,
  TokenSet,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts
// (Content Posting API: postingMethod/init, FILE_UPLOAD em chunks p/ vídeo, PULL_FROM_URL p/ foto,
// poll de status/fetch, taxonomia de erros por código). Divergências de propósito na autenticação:
// OAuth2 + PKCE S256 (o Postiz usa apenas client_key/secret) e ctx injetado (nada de env global).
// Traga-sua-chave: TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET vêm do env do self-hoster.

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const API_BASE = 'https://open.tiktokapis.com';
/** posting + user info; profile traz o username p/ montar a releaseUrl. */
const SCOPES = ['user.info.basic', 'user.info.profile', 'video.publish', 'video.upload'];
/** legenda do vídeo / descrição da foto — teto do TikTok. */
const MAX_LEN = 2200;

// Restrições de chunk do FILE_UPLOAD de vídeo (TikTok): um chunk vai de 5MB a 64MB. Quando o
// arquivo inteiro cabe num único chunk (<= 64MB) subimos numa requisição só; senão fatiamos em
// 10MB e o último chunk carrega o resto (o TikTok permite o último passar do chunk_size).
const SINGLE_CHUNK_MAX = 64 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024;

/** processamento assíncrono do TikTok pode levar minutos — ~9min de teto, sob o watchdog de zumbi (15min). */
const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 110;

const settingsSchema = z.object({
  privacyLevel: z
    .enum(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'])
    .default('SELF_ONLY')
    .describe(
      'Quem vê o post. Apps sem a auditoria de Direct Post aprovada só publicam como "Somente eu" (SELF_ONLY).',
    ),
  contentPostingMethod: z
    .enum(['DIRECT_POST', 'UPLOAD'])
    .default('DIRECT_POST')
    .describe(
      'DIRECT_POST publica direto no perfil; UPLOAD envia como rascunho para a caixa de entrada do app do TikTok (o usuário finaliza no celular).',
    ),
  title: z
    .string()
    .max(90)
    .optional()
    .describe('Título (apenas posts de foto, máx. 90 caracteres). Em vídeos a legenda é o texto do post.'),
  disableComment: z.boolean().default(false).describe('Desativar comentários.'),
  disableDuet: z.boolean().default(false).describe('Desativar Duetos (apenas vídeo).'),
  disableStitch: z.boolean().default(false).describe('Desativar Stitch (apenas vídeo).'),
  brandContentToggle: z
    .boolean()
    .default(false)
    .describe('Conteúdo de marca: parceria paga / publicidade de terceiros.'),
  brandOrganicToggle: z.boolean().default(false).describe('Promoção da sua própria marca.'),
  videoMadeWithAi: z.boolean().default(false).describe('Conteúdo gerado por IA (AIGC) — apenas vídeo.'),
  autoAddMusic: z.boolean().default(false).describe('Adicionar música automaticamente (apenas fotos).'),
});

type Settings = z.infer<typeof settingsSchema>;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const jsonAuth = (accessToken: string) => ({
  'content-type': 'application/json; charset=UTF-8',
  authorization: `Bearer ${accessToken}`,
});

/**
 * Chamada JSON ao TikTok: o envelope é `{ data, error: { code, message, log_id } }` e um erro
 * lógico pode vir com HTTP 200 e `error.code !== 'ok'` — por isso checamos o code também.
 * O corpo do throw preserva o code p/ o classifyError mapear (access_token_invalid, spam_risk...).
 */
async function tk<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  const json = (text ? JSON.parse(text) : {}) as { error?: { code?: string } };
  const code = json.error?.code;
  if (code && code !== 'ok') throw { status: res.status, body: JSON.stringify(json).slice(0, 2000) };
  return json as T;
}

interface TikTokTokenBody {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  open_id?: string;
  error?: string;
  error_description?: string;
}

/** Token endpoint OAuth2 (form-urlencoded); erros vêm no campo `error` mesmo com HTTP 200. */
async function oauthToken(ctx: ProviderContext, params: Record<string, string>): Promise<TokenSet> {
  const res = await ctx.fetch(`${API_BASE}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...params,
      client_key: ctx.secrets.clientKey ?? '',
      client_secret: ctx.secrets.clientSecret ?? '',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  const t = JSON.parse(text) as TikTokTokenBody;
  if (t.error) throw { status: 400, body: `${t.error}: ${t.error_description ?? ''}` };
  return {
    accessToken: t.access_token,
    // o refresh token do TikTok ROTACIONA a cada uso — o worker persiste o par novo (como X/Bluesky)
    ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
    expiresAt: new Date(ctx.now().getTime() + t.expires_in * 1000).toISOString(),
    scopes: t.scope?.split(/[ ,]/).filter(Boolean) ?? [],
  };
}

interface TikTokUser {
  open_id: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
}

/** Dono do token: open_id é a identidade do canal; username (scope profile) monta a releaseUrl. */
async function getUserInfo(ctx: ProviderContext, accessToken: string): Promise<TikTokUser> {
  const json = await tk<{ data?: { user?: TikTokUser } }>(
    ctx,
    `${API_BASE}/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  const user = json.data?.user;
  if (!user?.open_id) throw { status: 502, body: 'o TikTok não retornou os dados do usuário' };
  return user;
}

function chunkPlan(videoSize: number): { chunkSize: number; totalChunkCount: number } {
  if (videoSize <= SINGLE_CHUNK_MAX) return { chunkSize: videoSize, totalChunkCount: 1 };
  return { chunkSize: CHUNK_SIZE, totalChunkCount: Math.floor(videoSize / CHUNK_SIZE) };
}

/** DIRECT_POST publica direto; UPLOAD (inbox) manda p/ o rascunho no app. Foto sempre em /content/init/. */
function initPath(method: Settings['contentPostingMethod'], isPhoto: boolean): string {
  if (isPhoto) return '/content/init/';
  return method === 'UPLOAD' ? '/inbox/video/init/' : '/video/init/';
}

/** Corpo do init (post_info + source_info) — golden por rede (SPEC_INTEGRATIONS §7). */
function buildInitBody(
  cfg: Settings,
  item: PublishItem,
  isPhoto: boolean,
  videoPlan?: { chunkSize: number; totalChunkCount: number; videoSize: number },
): Record<string, unknown> {
  const direct = cfg.contentPostingMethod === 'DIRECT_POST';

  const postInfo: Record<string, unknown> = {};
  if (isPhoto) {
    if (cfg.title) postInfo.title = cfg.title.slice(0, 90);
    postInfo.description = item.content;
  } else if (item.content) {
    postInfo.title = item.content; // a legenda do vídeo vai no title
  }
  if (direct) {
    postInfo.privacy_level = cfg.privacyLevel;
    postInfo.disable_comment = cfg.disableComment;
    if (!isPhoto) {
      postInfo.disable_duet = cfg.disableDuet;
      postInfo.disable_stitch = cfg.disableStitch;
      postInfo.is_aigc = cfg.videoMadeWithAi;
    }
    postInfo.brand_content_toggle = cfg.brandContentToggle;
    postInfo.brand_organic_toggle = cfg.brandOrganicToggle;
    if (isPhoto) postInfo.auto_add_music = cfg.autoAddMusic;
  }

  if (isPhoto) {
    // fotos só têm PULL_FROM_URL (não há FILE_UPLOAD de foto na API) — exige URL pública alcançável
    return {
      post_info: postInfo,
      post_mode: direct ? 'DIRECT_POST' : 'MEDIA_UPLOAD',
      media_type: 'PHOTO',
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: item.media.map((m) => m.url),
      },
    };
  }

  return {
    post_info: postInfo,
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoPlan!.videoSize,
      chunk_size: videoPlan!.chunkSize,
      total_chunk_count: videoPlan!.totalChunkCount,
    },
  };
}

/** Sobe os bytes do vídeo ao upload_url do init, chunk a chunk (Content-Range); 200/201/206 = ok. */
async function uploadVideoChunks(
  ctx: ProviderContext,
  uploadUrl: string,
  bytes: Uint8Array,
  plan: { chunkSize: number; totalChunkCount: number },
  contentType: string,
): Promise<void> {
  const total = bytes.byteLength;
  for (let i = 0; i < plan.totalChunkCount; i++) {
    const start = i * plan.chunkSize;
    const end = i === plan.totalChunkCount - 1 ? total - 1 : start + plan.chunkSize - 1;
    const res = await ctx.fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': contentType,
        'content-length': String(end - start + 1),
        'content-range': `bytes ${start}-${end}/${total}`,
      },
      body: bytes.slice(start, end + 1),
    });
    if (![200, 201, 206].includes(res.status)) {
      throw { status: res.status, body: (await res.text()).slice(0, 2000) };
    }
  }
}

interface StatusData {
  status: string;
  publicaly_available_post_id?: Array<string | number>;
  fail_reason?: string;
}

/** Poll do processamento pós-init até PUBLISH_COMPLETE / SEND_TO_USER_INBOX / FAILED. */
async function pollStatus(
  ctx: ProviderContext,
  accessToken: string,
  publishId: string,
  username?: string,
): Promise<PublishResult> {
  for (let i = 0; i < MAX_POLLS; i++) {
    const { data } = await tk<{ data: StatusData }>(
      ctx,
      `${API_BASE}/v2/post/publish/status/fetch/`,
      {
        method: 'POST',
        headers: jsonAuth(accessToken),
        body: JSON.stringify({ publish_id: publishId }),
      },
    );

    if (data.status === 'SEND_TO_USER_INBOX') {
      // upload p/ inbox: o post vira rascunho no app do TikTok e o usuário finaliza lá
      return { externalId: publishId, releaseUrl: 'https://www.tiktok.com/' };
    }
    if (data.status === 'PUBLISH_COMPLETE') {
      const videoId = data.publicaly_available_post_id?.[0];
      const idStr = videoId != null ? String(videoId) : publishId;
      const releaseUrl = username
        ? videoId != null
          ? `https://www.tiktok.com/@${username}/video/${idStr}`
          : `https://www.tiktok.com/@${username}`
        : 'https://www.tiktok.com/';
      return { externalId: idStr, releaseUrl };
    }
    if (data.status === 'FAILED') {
      throw { status: 422, body: JSON.stringify(data).slice(0, 2000) };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw { status: 504, body: 'o TikTok demorou demais para processar a publicação' };
}

export const tiktokProvider: ChannelProvider = {
  id: 'tiktok',
  name: 'TikTok',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_LEN,
    media: {
      // carrossel de fotos aceita várias imagens (PULL_FROM_URL); o TikTok reforça formato/resolução no processamento
      images: { maxCount: 35, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
      videos: { maxCount: 1, mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'] },
    },
    threads: false, // TikTok não tem thread/comentário encadeado
    mentions: false,
    analytics: false, // séries de métricas ficam p/ a camada de analytics (scopes user.info.stats/video.list)
    twoStepConnect: false,
    customInstance: false,
    requiresMedia: true, // um vídeo OU pelo menos uma foto — nunca só texto
  },
  rateDefaults: {
    // TikTok limita ~6 publicações/min por usuário e no máx. 5 posts pendentes em 24h — nunca paralelizar
    maxConcurrent: 1,
    perChannelWindow: { limit: 6, windowSec: 60 },
  },
  settingsSchema,
  requiredSecrets: ['clientKey', 'clientSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const codeVerifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const q = new URLSearchParams({
      client_key: ctx.secrets.clientKey ?? '',
      scope: SCOPES.join(','), // TikTok separa escopos por vírgula (X separa por espaço)
      response_type: 'code',
      redirect_uri: redirectUri,
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
    if (!set.scopes.includes('video.publish') && !set.scopes.includes('video.upload')) {
      throw {
        status: 403,
        body: 'permissão de publicação não concedida (video.publish/video.upload) — refaça a conexão marcando todas as permissões',
      };
    }
    const user = await getUserInfo(ctx, set.accessToken);
    return {
      ...set,
      externalId: user.open_id,
      name: user.display_name ?? 'TikTok',
      ...(user.username ? { username: user.username } : {}),
      ...(user.avatar_url ? { avatarUrl: user.avatar_url } : {}),
      // username monta a releaseUrl do post (@handle/video/id)
      ...(user.username ? { channelSettings: { username: user.username } } : {}),
    };
  },

  async refreshToken(ctx, refreshToken) {
    return oauthToken(ctx, { grant_type: 'refresh_token', refresh_token: refreshToken });
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    if (!item || item.media.length === 0) {
      throw { status: 422, body: 'o TikTok exige um vídeo ou pelo menos uma foto' };
    }
    // username vem do settings do CANAL (merge) — zod strip descarta antes de validar
    const { username } = (rawSettings ?? {}) as { username?: string };
    const cfg = settingsSchema.parse(rawSettings ?? {});
    const isPhoto = item.media[0]!.type === 'image';

    let videoBytes: Uint8Array | undefined;
    let plan: { chunkSize: number; totalChunkCount: number } | undefined;
    if (!isPhoto) {
      const src = await ctx.fetch(item.media[0]!.url, { signal: AbortSignal.timeout(120_000) });
      if (!src.ok) throw { status: 422, body: `vídeo inacessível para o worker: HTTP ${src.status}` };
      videoBytes = new Uint8Array(await src.arrayBuffer());
      plan = chunkPlan(videoBytes.byteLength);
    }

    const body = buildInitBody(
      cfg,
      item,
      isPhoto,
      plan ? { ...plan, videoSize: videoBytes!.byteLength } : undefined,
    );
    const { data } = await tk<{ data: { publish_id: string; upload_url?: string } }>(
      ctx,
      `${API_BASE}/v2/post/publish${initPath(cfg.contentPostingMethod, isPhoto)}`,
      { method: 'POST', headers: jsonAuth(token.accessToken), body: JSON.stringify(body) },
    );

    if (!isPhoto && data.upload_url && videoBytes && plan) {
      await uploadVideoChunks(ctx, data.upload_url, videoBytes, plan, item.media[0]!.mime ?? 'video/mp4');
    }

    const result = await pollStatus(ctx, token.accessToken, data.publish_id, username);
    return [result];
  },

  async validateMedia(items) {
    // o TikTok não aceita post só-texto (requiresMedia); mistura vídeo+foto e contagem seguem o helper
    if ((items[0]?.media.length ?? 0) === 0) {
      return { ok: false, reason: 'o TikTok exige um vídeo ou pelo menos uma foto' };
    }
    return checkMediaRules(items, tiktokProvider.capabilities.media);
  },

  classifyError(status, body) {
    // reconectar: token inválido/expirado ou escopo revogado
    if (status === 401 || /access_token_invalid|scope_not_authorized|scope_permission_missed/i.test(body)) {
      return 'refresh-token';
    }
    // retentável: rate limit curto, instabilidade e 5xx do TikTok
    if (status === 429 || status >= 500 || /rate_limit_exceeded|internal_error/i.test(body)) {
      return 'transient';
    }
    // o resto (spam_risk, file_format_check_failed, privacy_level_option_mismatch, url_ownership_unverified…) = permanente
    return 'permanent';
  },
};
