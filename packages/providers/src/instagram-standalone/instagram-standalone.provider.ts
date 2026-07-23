import { z } from 'zod';
import type {
  ChannelProvider,
  MediaRef,
  ProviderContext,
  PublishResult,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/instagram.standalone.provider.ts
// e instagram.provider.ts (o standalone delega post/comment ao provider base passando o host
// `graph.instagram.com`). Portado: o OAuth do Instagram Login (token curto → ig_exchange_token →
// token longo, refresh por ig_refresh_token), o fluxo container `/media` → poll `status_code` →
// `/media_publish`, o carrossel por filhos `is_carousel_item` e a taxonomia de erros da Meta.
// Divergências de propósito (iguais às do nosso Threads): ctx injetado (nada de env global nem
// fetch global), settings tipados por Zod, parâmetros no CORPO do POST (o Postiz monta query
// string), permalink best-effort (depois do media_publish o post já está na rede — lançar faria a
// máquina de estados retentar e repostar) e story de mídia ÚNICA (não existe carrossel de story;
// barrar >1 evita publicar o 1º story e duplicá-lo no retry).
// Traga-sua-chave: INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET vêm do env do self-hoster.

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
/** troca do code por token curto (1h) — endpoint próprio, fora da Graph API */
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
/** os endpoints de token vivem FORA da versão: /access_token (ig_exchange_token), /refresh_access_token */
const OAUTH_BASE = 'https://graph.instagram.com';
const API_BASE = 'https://graph.instagram.com/v21.0';
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_comments',
  'instagram_business_manage_insights',
];
const MAX_LEN = 2200;
/** carrossel do Instagram: 2 a 10 itens, imagens e vídeos podem se misturar */
const CAROUSEL_MAX = 10;
/** o token longo do Instagram Login dura ~60 dias (a resposta traz expires_in; isto é o piso do fallback) */
const LONG_LIVED_FALLBACK_SEC = 60 * 24 * 3600;

// A Meta processa mídia em segundo plano: o container só pode ser publicado em FINISHED. O
// orçamento de polls é COMPARTILHADO por publicação (pai + filhos do carrossel) para o total
// ficar abaixo do watchdog de zumbis (15 min) mesmo num carrossel de 10 vídeos.
const POLL_INTERVAL_MS = 3_000;
const POLL_BUDGET = 140; // ~7 min somados

const settingsSchema = z.object({
  postType: z
    .enum(['feed', 'story'])
    .default('feed')
    .describe(
      'Onde publicar: no feed (foto, reel ou carrossel de até 10) ou como story (uma mídia, some em 24h).',
    ),
});

type Settings = z.infer<typeof settingsSchema>;

/** gravado no canal na conexão (channelSettings) e lido do merge canal+publicação no publish */
interface ChannelSettings {
  userId?: string;
  username?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Chamada à Graph API do Instagram. Erro da Meta é `{ error: { message, type, code, error_subcode } }`;
 * os endpoints de token às vezes devolvem esse envelope com HTTP 200, por isso checamos o corpo
 * também. O corpo cru vai no throw para o classifyError casar código e mensagem.
 */
async function ig<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  const json = (text ? JSON.parse(text) : {}) as { error?: unknown };
  if (json.error) throw { status: 400, body: text.slice(0, 2000) };
  return json as T;
}

/** corpo form-urlencoded sem chaves vazias (mídia sem legenda não manda `caption`). */
const form = (params: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as Array<[string, string]>,
  );

const apiPost = <T>(
  ctx: ProviderContext,
  path: string,
  params: Record<string, string | undefined>,
): Promise<T> =>
  ig<T>(ctx, `${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form(params),
  });

interface TokenBody {
  access_token: string;
  expires_in?: number;
  permissions?: string[];
}

/**
 * TokenSet do Instagram Login: **não existe refresh token separado** — o próprio token longo é
 * apresentado ao /refresh_access_token (ig_refresh_token), então guardamos o mesmo valor nos dois
 * campos (é o que faz o worker persistir a rotação a cada renovação). Mesmo modelo do Threads.
 */
function tokenSetFrom(ctx: ProviderContext, t: TokenBody) {
  const seconds = t.expires_in ?? LONG_LIVED_FALLBACK_SEC;
  return {
    accessToken: t.access_token,
    refreshToken: t.access_token,
    expiresAt: new Date(ctx.now().getTime() + seconds * 1000).toISOString(),
    scopes: t.permissions?.length ? t.permissions : SCOPES,
  };
}

/** a Meta devolve `permissions` ora como array, ora como string separada por vírgula. */
function grantedScopes(permissions: unknown): string[] {
  if (Array.isArray(permissions)) return permissions.map(String);
  if (typeof permissions === 'string') return permissions.split(',').filter(Boolean);
  return [];
}

interface IgUser {
  user_id?: string | number;
  id?: string | number;
  username?: string;
  name?: string;
  profile_picture_url?: string;
}

async function fetchUser(ctx: ProviderContext, accessToken: string): Promise<IgUser> {
  const q = new URLSearchParams({
    fields: 'user_id,username,name,profile_picture_url',
    access_token: accessToken,
  });
  const me = await ig<IgUser>(ctx, `${API_BASE}/me?${q}`);
  if (me?.user_id == null && me?.id == null) {
    throw { status: 502, body: 'o Instagram não retornou o perfil da conta' };
  }
  return me;
}

interface MediaOpts {
  story: boolean;
  carouselItem: boolean;
}

/**
 * Parâmetros do container de uma mídia + a URL pública correspondente: a Meta faz *pull* da mídia
 * (não subimos bytes). No feed, vídeo único vira REELS; dentro de carrossel vira VIDEO; story vira
 * STORIES. Imagem no feed dispensa media_type (IMAGE é o default). Sem alt_text: a Content
 * Publishing API não aceita texto alternativo na criação do container.
 */
function mediaParams(m: MediaRef, opts: MediaOpts): Record<string, string | undefined> {
  const carousel = opts.carouselItem ? { is_carousel_item: 'true' } : {};
  if (m.type === 'video') {
    const media_type = opts.story ? 'STORIES' : opts.carouselItem ? 'VIDEO' : 'REELS';
    return { ...carousel, video_url: m.url, media_type };
  }
  return { ...carousel, image_url: m.url, ...(opts.story ? { media_type: 'STORIES' } : {}) };
}

/** Poll do container até FINISHED. ERROR/EXPIRED = permanente; estourar o orçamento = transient
 *  (nada foi publicado ainda, então retentar é seguro e nunca duplica). */
async function waitContainer(
  ctx: ProviderContext,
  accessToken: string,
  containerId: string,
  budget: { left: number },
): Promise<void> {
  while (budget.left > 0) {
    budget.left -= 1;
    const q = new URLSearchParams({ fields: 'status_code,status', access_token: accessToken });
    const { status_code, status } = await ig<{ status_code?: string; status?: string }>(
      ctx,
      `${API_BASE}/${containerId}?${q}`,
    );
    const s = status_code ?? status;
    if (!s || s === 'FINISHED' || s === 'PUBLISHED') return;
    if (s === 'ERROR' || s === 'EXPIRED') {
      throw { status: 422, body: status ?? `o Instagram recusou a mídia (${s})` };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw { status: 504, body: 'o Instagram demorou demais para processar a mídia' };
}

const createContainer = async (
  ctx: ProviderContext,
  userId: string,
  accessToken: string,
  params: Record<string, string | undefined>,
): Promise<string> => {
  const { id } = await apiPost<{ id: string }>(ctx, `/${userId}/media`, {
    ...params,
    access_token: accessToken,
  });
  return id;
};

/** Espera o container, publica e resolve o permalink (best-effort — o post já está na rede). */
async function publishCreation(
  ctx: ProviderContext,
  userId: string,
  accessToken: string,
  creationId: string,
  username: string | undefined,
  budget: { left: number },
): Promise<PublishResult> {
  await waitContainer(ctx, accessToken, creationId, budget);
  const { id: mediaId } = await apiPost<{ id: string }>(ctx, `/${userId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });

  // DAQUI PARA BAIXO o post JÁ ESTÁ na rede: lançar faria a máquina de estados retentar e
  // repostar. O permalink é enfeite — falhou, cai no perfil (ou fica sem URL).
  const releaseUrl = (await permalinkOf(ctx, mediaId, accessToken)) ?? profileUrl(username);
  return { externalId: mediaId, ...(releaseUrl ? { releaseUrl } : {}) };
}

async function permalinkOf(
  ctx: ProviderContext,
  mediaId: string,
  accessToken: string,
): Promise<string | undefined> {
  try {
    const q = new URLSearchParams({ fields: 'permalink', access_token: accessToken });
    return (await ig<{ permalink?: string }>(ctx, `${API_BASE}/${mediaId}?${q}`)).permalink;
  } catch {
    return undefined;
  }
}

const profileUrl = (username: string | undefined): string | undefined =>
  username ? `https://www.instagram.com/${username.replace(/^@/, '')}` : undefined;

export const instagramStandaloneProvider: ChannelProvider = {
  id: 'instagram-standalone',
  name: 'Instagram',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_LEN,
    media: {
      // um post = 1 mídia OU carrossel de até 10 itens misturando imagem e vídeo
      images: { maxCount: CAROUSEL_MAX, mimeTypes: ['image/jpeg', 'image/png'] },
      videos: { maxCount: CAROUSEL_MAX, mimeTypes: ['video/mp4', 'video/quicktime'] },
    },
    // o Instagram não aceita post só-texto — precisa de foto ou vídeo (como o TikTok)
    requiresMedia: true,
    // réplicas de thread viram COMENTÁRIOS no post (só texto) — paridade com o comment() do Postiz
    threads: true,
    mentions: false,
    analytics: false, // instagram_manage_insights fica p/ a fatia de analytics
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    // Derived from Postiz (AGPL-3.0): maxConcurrentJob = 200 no standalone. Nossa semântica de
    // maxConcurrent é semáforo por provider; um teto modesto basta. Limite documentado da API:
    // ~25 posts publicados por conta em 24h (erro 2207042).
    maxConcurrent: 3,
    perChannelWindow: { limit: 25, windowSec: 86_400 },
  },
  settingsSchema,
  requiredSecrets: ['appId', 'appSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const q = new URLSearchParams({
      // Instagram Login puro (sem passar pelo login do Facebook)
      enable_fb_login: '0',
      client_id: ctx.secrets.appId ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(','), // a Meta separa escopos por vírgula
      state,
    });
    return { url: `${AUTHORIZE_URL}?${q}`, state };
  },

  async exchangeCode(ctx, { code, redirectUri }) {
    // 1) code → token curto (1h) + user_id, no endpoint próprio do Instagram (form-urlencoded)
    const short = await ig<{ access_token: string; user_id?: string | number; permissions?: unknown }>(
      ctx,
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form({
          client_id: ctx.secrets.appId,
          client_secret: ctx.secrets.appSecret,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code,
        }),
      },
    );
    // a conexão só serve se o usuário concedeu a permissão de publicar (quando a Meta informa)
    const granted = grantedScopes(short.permissions);
    if (granted.length && !granted.includes('instagram_business_content_publish')) {
      throw {
        status: 403,
        body: 'permissão de publicação não concedida (instagram_business_content_publish) — refaça a conexão marcando todas as permissões',
      };
    }

    // 2) token curto → token LONGO (~60 dias) por ig_exchange_token; é ele que fica cifrado no canal
    const q = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: ctx.secrets.appSecret ?? '',
      access_token: short.access_token,
    });
    const long = await ig<TokenBody>(ctx, `${OAUTH_BASE}/access_token?${q}`);
    const set = tokenSetFrom(ctx, { ...long, ...(granted.length ? { permissions: granted } : {}) });

    const me = await fetchUser(ctx, set.accessToken);
    const userId = String(me.user_id ?? me.id ?? short.user_id);
    return {
      ...set,
      externalId: userId,
      name: me.name || me.username || 'Instagram',
      ...(me.username ? { username: me.username } : {}),
      ...(me.profile_picture_url ? { avatarUrl: me.profile_picture_url } : {}),
      // userId endereça /{userId}/media no publish; username monta a releaseUrl de fallback
      channelSettings: { userId, ...(me.username ? { username: me.username } : {}) },
    };
  },

  async refreshToken(ctx, refreshToken) {
    // ig_refresh_token estende por mais ~60 dias; só funciona com token VÁLIDO (>24h de vida).
    // Token que expirou (60 dias sem uso) não volta: o canal cai em REFRESH_REQUIRED (reconectar).
    const q = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: refreshToken,
    });
    const t = await ig<TokenBody>(ctx, `${OAUTH_BASE}/refresh_access_token?${q}`);
    return tokenSetFrom(ctx, t);
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    if (!item) return [];
    // userId/username vêm do settings do CANAL (merge) — o zod não-strict os descarta no parse
    const { userId, username } = (rawSettings ?? {}) as ChannelSettings;
    const cfg = settingsSchema.parse(rawSettings ?? {});
    const isStory = cfg.postType === 'story';
    const uid = userId ?? 'me';
    const media = item.media;
    const budget = { left: POLL_BUDGET };

    // o Instagram nunca publica sem mídia — o agendamento já barra (requiresMedia), isto é o cinto
    if (media.length === 0) {
      throw { status: 422, body: 'o Instagram exige ao menos uma imagem ou vídeo' };
    }

    if (isStory) {
      // não existe carrossel de story: barrar >1 evita publicar o 1º e o retry duplicá-lo
      if (media.length > 1) {
        throw {
          status: 422,
          body: 'story do Instagram aceita uma mídia por vez — agende posts separados',
        };
      }
      const creationId = await createContainer(
        ctx,
        uid,
        token.accessToken,
        mediaParams(media[0]!, { story: true, carouselItem: false }),
      );
      return [await publishCreation(ctx, uid, token.accessToken, creationId, username, budget)];
    }

    if (media.length === 1) {
      const creationId = await createContainer(ctx, uid, token.accessToken, {
        ...mediaParams(media[0]!, { story: false, carouselItem: false }),
        caption: item.content,
      });
      return [await publishCreation(ctx, uid, token.accessToken, creationId, username, budget)];
    }

    // carrossel 2–10: filhos SEM legenda (só o pai carrega a caption)
    const children: string[] = [];
    for (const m of media) {
      children.push(
        await createContainer(
          ctx,
          uid,
          token.accessToken,
          mediaParams(m, { story: false, carouselItem: true }),
        ),
      );
    }
    // os filhos precisam estar processados ANTES de virar carrossel
    for (const id of children) await waitContainer(ctx, token.accessToken, id, budget);

    const parent = await createContainer(ctx, uid, token.accessToken, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption: item.content,
    });
    return [await publishCreation(ctx, uid, token.accessToken, parent, username, budget)];
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    // no Instagram a thread vira comentários no post raiz (só texto) — comment() do Postiz
    const { username } = (rawSettings ?? {}) as ChannelSettings;
    const { id: commentId } = await apiPost<{ id: string }>(ctx, `/${parentExternalId}/comments`, {
      message: item.content,
      access_token: token.accessToken,
    });
    // o comentário não tem URL própria: cai no permalink do post pai (ou no perfil)
    const releaseUrl =
      (await permalinkOf(ctx, parentExternalId, token.accessToken)) ?? profileUrl(username);
    return { externalId: commentId, ...(releaseUrl ? { releaseUrl } : {}) };
  },

  async validateMedia(items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (i === 0) {
        if (item.media.length === 0) {
          return { ok: false, reason: 'o Instagram exige ao menos uma imagem ou vídeo' };
        }
        if (item.media.length > CAROUSEL_MAX) {
          return { ok: false, reason: `máximo de ${CAROUSEL_MAX} itens no carrossel do Instagram` };
        }
        // carrossel do Instagram aceita imagem e vídeo no mesmo post (allowMixed)
        const verdict = checkMediaRules(
          [item],
          instagramStandaloneProvider.capabilities.media,
          { allowMixed: true },
        );
        if (!verdict.ok) return verdict;
      } else if (item.media.length > 0) {
        // réplicas são comentários — o endpoint de comentário só aceita texto
        return { ok: false, reason: 'comentários no Instagram são somente texto' };
      }
    }
    return { ok: true };
  },

  classifyError(status, body) {
    // token expirado/revogado ou conta que deixou de ser business: refresh e, se não der, reconexão
    if (
      status === 401 ||
      /REVOKED_ACCESS_TOKEN|"error_subcode":\s*33|not an instagram business|session has been invalidated|Error validating access token|OAuthException|"code":\s*190\b/i.test(
        body,
      )
    ) {
      return 'refresh-token';
    }
    // instabilidade da Meta, limites de chamada e soluços transitórios de upload/download de mídia
    if (
      status === 429 ||
      status >= 500 ||
      /An unknown error occurred|2207003|2207082|"code":\s*(1|2|4|17|32|341|613)\b|rate limit/i.test(
        body,
      )
    ) {
      return 'transient';
    }
    // o resto é permanente: mídia inválida/formato/proporção, spam (2207001), conta restrita
    // (2207050/2207051), teto diário (2207042), legenda longa (2207010), URL não pública etc.
    return 'permanent';
  },
};
