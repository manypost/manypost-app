import { z } from 'zod';
import type {
  ChannelProvider,
  ConnectedToken,
  MediaRef,
  ProviderContext,
  PublishItem,
  PublishResult,
  SubAccount,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts
// Portado: o OAuth do Facebook Login (code → token curto → fb_exchange_token → token longo ~60d), a
// resolução das Páginas por /me/accounts + Business Manager (owned_pages/client_pages), a publicação
// no feed (foto/álbum via /photos published:false → /feed attached_media; vídeo único via /videos
// file_url; story de foto via /photo_stories e de vídeo via /video_stories em fases) e a taxonomia de
// erros da Graph API. Divergências de propósito (iguais às do nosso Threads/Instagram): ctx injetado
// (nada de env global nem fetch global), settings tipados por Zod, e — o ponto central do desenho — o
// **token da Página é derivado no publish** a partir do token do usuário (nunca guardado em
// `settings`, que é jsonb sem cifra): a Página é escolhida por post via `listSubAccounts`
// (padrão do Discord, STATUS §4.1). Story restrito a UMA mídia (Postiz publica cada mídia como um
// story separado, o que duplicaria no retry — mesma decisão do Instagram standalone). Permalink
// best-effort: depois que o post está na rede, nada lança (senão a máquina de estados repostaria).
// Traga-sua-chave: FACEBOOK_APP_ID/FACEBOOK_APP_SECRET vêm do env do self-hoster.

const API_BASE = 'https://graph.facebook.com/v20.0';
const AUTHORIZE_URL = 'https://www.facebook.com/v20.0/dialog/oauth';
const SCOPES = [
  'pages_show_list',
  'business_management',
  'pages_manage_posts',
  'pages_manage_engagement',
  'pages_read_engagement',
  'read_insights',
];
const MAX_LEN = 63206;
/** feed de fotos do Facebook: um álbum de até 10 imagens num único post */
const ALBUM_MAX = 10;
/** o token longo do Facebook dura ~60 dias (a resposta traz expires_in; isto é o piso do fallback) */
const LONG_LIVED_FALLBACK_SEC = 60 * 24 * 3600;

// Vídeo de story processa em segundo plano — só finaliza quando `ready`. O orçamento mantém o
// total abaixo do watchdog de zumbis (15 min); estourar = 504 transient (nada publicado ⇒ retry seguro).
const POLL_INTERVAL_MS = 3_000;
const STORY_POLL_BUDGET = 100; // ~5 min somados

const settingsSchema = z.object({
  // OBRIGATÓRIO (padrão do Discord): a Página é escolhida por post no composer (SubAccountsField
  // lista as Páginas que a pessoa administra). Sem ela o agendamento falha na validação de settings.
  pageId: z
    .string()
    .min(1)
    .describe('Página do Facebook onde publicar — escolha entre as Páginas que você administra.'),
  postType: z
    .enum(['feed', 'story'])
    .default('feed')
    .describe(
      'Onde publicar: no feed da Página (texto, foto, álbum ou vídeo) ou como story (uma mídia, some em 24h).',
    ),
});

/** settings de publicação lidos do merge canal+publicação (o zod não-strict descarta o resto). */
interface PublishSettings {
  pageId?: string;
  postType?: 'feed' | 'story';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Chamada à Graph API do Facebook. Erro da Meta é `{ error: { message, type, code, error_subcode } }`;
 * alguns endpoints devolvem esse envelope com HTTP 200, por isso checamos o corpo também. O corpo cru
 * vai no throw para o classifyError casar código e mensagem.
 */
async function fb<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  const json = (text ? JSON.parse(text) : {}) as { error?: unknown };
  if (json.error) throw { status: 400, body: text.slice(0, 2000) };
  return json as T;
}

/** POST com corpo JSON; o access_token (do usuário OU da Página) vai na query, como no Postiz. */
function fbPost<T>(
  ctx: ProviderContext,
  path: string,
  body: object,
  accessToken: string,
  fields?: string,
): Promise<T> {
  const q = new URLSearchParams({ access_token: accessToken, ...(fields ? { fields } : {}) });
  return fb<T>(ctx, `${API_BASE}${path}?${q}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface TokenBody {
  access_token: string;
  expires_in?: number;
}

/**
 * TokenSet do Facebook Login: **não existe refresh token separado** — o token longo é reapresentado
 * ao fb_exchange_token para renovar, então guardamos o mesmo valor nos dois campos (é o que faz o
 * worker persistir a rotação). Mesmo modelo do Threads/Instagram.
 */
function tokenSetFrom(ctx: ProviderContext, t: TokenBody, scopes?: string[]) {
  const seconds = t.expires_in ?? LONG_LIVED_FALLBACK_SEC;
  return {
    accessToken: t.access_token,
    refreshToken: t.access_token,
    expiresAt: new Date(ctx.now().getTime() + seconds * 1000).toISOString(),
    scopes: scopes?.length ? scopes : SCOPES,
  };
}

/** Token da Página derivado do token do usuário — nunca guardado em settings (é um segredo). */
async function pageToken(ctx: ProviderContext, userToken: string, pageId: string): Promise<string> {
  const q = new URLSearchParams({ fields: 'access_token', access_token: userToken });
  const { access_token } = await fb<{ access_token?: string }>(ctx, `${API_BASE}/${pageId}?${q}`);
  if (!access_token) {
    throw {
      status: 403,
      body: 'sem token de publicação para esta Página — confirme que você a administra e reconecte',
    };
  }
  return access_token;
}

interface FbPage {
  id: string;
  name: string;
  username?: string;
  picture?: { data?: { url?: string } };
}

/**
 * Páginas administradas pela pessoa: /me/accounts (as escolhidas no diálogo) + Business Manager
 * (owned_pages/client_pages, para as que não apareceram no passo de seleção). O Business Manager
 * exige `business_management` e nem todo usuário tem — por isso é best-effort (try/catch).
 */
async function fetchPages(ctx: ProviderContext, userToken: string): Promise<FbPage[]> {
  const seen = new Set<string>();
  const all: FbPage[] = [];
  const fields = 'id,name,username,picture.type(large)';

  const paginate = async (start: string) => {
    let next: string | undefined = start;
    while (next) {
      // tipo anotado (não inferido) — `next` é reatribuído a partir de `resp`, o que criaria inferência circular
      const resp: { data?: FbPage[]; paging?: { next?: string } } = await fb(ctx, next);
      for (const pg of resp.data ?? []) {
        if (!seen.has(pg.id)) {
          seen.add(pg.id);
          all.push(pg);
        }
      }
      next = resp.paging?.next;
    }
  };

  await paginate(`${API_BASE}/me/accounts?fields=${fields}&limit=100&access_token=${userToken}`);

  try {
    let bizUrl: string | undefined = `${API_BASE}/me/businesses?access_token=${userToken}`;
    while (bizUrl) {
      const biz: { data?: Array<{ id: string }>; paging?: { next?: string } } = await fb(ctx, bizUrl);
      for (const b of biz.data ?? []) {
        for (const edge of ['owned_pages', 'client_pages']) {
          try {
            await paginate(
              `${API_BASE}/${b.id}/${edge}?fields=${fields}&limit=100&access_token=${userToken}`,
            );
          } catch {
            // outra Página/negócio pode falhar isolado — segue
          }
        }
      }
      bizUrl = biz.paging?.next;
    }
  } catch {
    // Business Manager indisponível para esta conta — /me/accounts já basta
  }

  return all;
}

const feedUrl = (id: string) => `https://www.facebook.com/${id}`;
const storyUrl = (postId: string) => `https://www.facebook.com/stories/${postId}`;

/** Feed de texto + álbum de fotos (0–10). Fotos sobem como não publicadas e o /feed as anexa num
 *  único post — retry antes do /feed só deixa fotos ocultas órfãs (a Meta as recolhe), nunca duplica. */
async function publishFeed(
  ctx: ProviderContext,
  pageId: string,
  pgToken: string,
  media: MediaRef[],
  message: string,
): Promise<PublishResult> {
  const attached: Array<{ media_fbid: string }> = [];
  for (const m of media) {
    const { id } = await fbPost<{ id: string }>(
      ctx,
      `/${pageId}/photos`,
      { url: m.url, published: false },
      pgToken,
    );
    attached.push({ media_fbid: id });
  }
  const { id, permalink_url } = await fbPost<{ id: string; permalink_url?: string }>(
    ctx,
    `/${pageId}/feed`,
    { message, ...(attached.length ? { attached_media: attached } : {}), published: true },
    pgToken,
    'id,permalink_url',
  );
  return { externalId: id, releaseUrl: permalink_url ?? feedUrl(id) };
}

/** Vídeo único no feed = reel. A Meta faz *pull* da mídia por `file_url` (não subimos bytes). */
async function publishVideo(
  ctx: ProviderContext,
  pageId: string,
  pgToken: string,
  m: MediaRef,
  description: string,
): Promise<PublishResult> {
  const { id, permalink_url } = await fbPost<{ id: string; permalink_url?: string }>(
    ctx,
    `/${pageId}/videos`,
    { file_url: m.url, description, published: true },
    pgToken,
    'id,permalink_url',
  );
  return { externalId: id, releaseUrl: permalink_url ?? feedUrl(id) };
}

/** Story de foto: sobe a foto oculta e a promove a story. */
async function publishPhotoStory(
  ctx: ProviderContext,
  pageId: string,
  pgToken: string,
  m: MediaRef,
): Promise<PublishResult> {
  const { id: photoId } = await fbPost<{ id: string }>(
    ctx,
    `/${pageId}/photos`,
    { url: m.url, published: false },
    pgToken,
  );
  const q = new URLSearchParams({ photo_id: photoId, access_token: pgToken });
  const { post_id } = await fb<{ post_id: string }>(
    ctx,
    `${API_BASE}/${pageId}/photo_stories?${q}`,
    { method: 'POST' },
  );
  return { externalId: post_id, releaseUrl: storyUrl(post_id) };
}

/** Story de vídeo em fases: start → upload hospedado (a Meta puxa por file_url) → poll → finish. */
async function publishVideoStory(
  ctx: ProviderContext,
  pageId: string,
  pgToken: string,
  m: MediaRef,
): Promise<PublishResult> {
  const startQ = new URLSearchParams({ upload_phase: 'start', access_token: pgToken });
  const { video_id, upload_url } = await fb<{ video_id: string; upload_url: string }>(
    ctx,
    `${API_BASE}/${pageId}/video_stories?${startQ}`,
    { method: 'POST' },
  );

  const up = await ctx.fetch(upload_url, {
    method: 'POST',
    headers: { Authorization: `OAuth ${pgToken}`, file_url: m.url },
  });
  if (!up.ok) throw { status: up.status, body: (await up.text()).slice(0, 2000) };

  const budget = { left: STORY_POLL_BUDGET };
  while (budget.left > 0) {
    budget.left -= 1;
    const q = new URLSearchParams({ fields: 'status', access_token: pgToken });
    const { status } = await fb<{ status?: { video_status?: string } }>(
      ctx,
      `${API_BASE}/${video_id}?${q}`,
    );
    const s = status?.video_status;
    if (s === 'ready' || s === 'upload_complete') break;
    if (s === 'error') throw { status: 422, body: 'o Facebook falhou ao processar o vídeo do story' };
    if (budget.left === 0) {
      throw { status: 504, body: 'o Facebook demorou demais para processar o vídeo do story' };
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const finQ = new URLSearchParams({ upload_phase: 'finish', video_id, access_token: pgToken });
  const { post_id } = await fb<{ post_id: string }>(
    ctx,
    `${API_BASE}/${pageId}/video_stories?${finQ}`,
    { method: 'POST' },
  );
  return { externalId: post_id, releaseUrl: storyUrl(post_id) };
}

export const facebookProvider: ChannelProvider = {
  id: 'facebook',
  name: 'Facebook Page',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_LEN,
    media: {
      // feed = álbum de até 10 fotos OU 1 vídeo (a Meta não mistura foto e vídeo num post)
      images: { maxCount: ALBUM_MAX, mimeTypes: ['image/jpeg', 'image/png', 'image/gif'] },
      videos: { maxCount: 1, mimeTypes: ['video/mp4', 'video/quicktime'] },
    },
    // o Facebook aceita post só-texto (diferente de Instagram/TikTok)
    requiresMedia: false,
    // réplicas de thread viram COMENTÁRIOS no post raiz (texto + no máx. 1 foto) — comment() do Postiz
    threads: true,
    mentions: false,
    analytics: false, // read_insights fica p/ a fatia de analytics
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    // Derived from Postiz (AGPL-3.0): maxConcurrentJob = 500. Nossa semântica é semáforo por
    // provider; um teto modesto basta. Janela por Página conservadora contra o "posting too fast".
    maxConcurrent: 5,
    perChannelWindow: { limit: 25, windowSec: 3600 },
  },
  settingsSchema,
  requiredSecrets: ['appId', 'appSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const q = new URLSearchParams({
      client_id: ctx.secrets.appId ?? '',
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: SCOPES.join(','), // a Meta separa escopos por vírgula
    });
    return { url: `${AUTHORIZE_URL}?${q}`, state };
  },

  async exchangeCode(ctx, { code, redirectUri }) {
    // 1) code → token curto do usuário (GET, params na query — como no Postiz)
    const shortQ = new URLSearchParams({
      client_id: ctx.secrets.appId ?? '',
      client_secret: ctx.secrets.appSecret ?? '',
      redirect_uri: redirectUri,
      code,
    });
    const short = await fb<TokenBody>(ctx, `${API_BASE}/oauth/access_token?${shortQ}`);

    // 2) token curto → token LONGO (~60 dias) por fb_exchange_token; é ele que fica cifrado no canal
    const longQ = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: ctx.secrets.appId ?? '',
      client_secret: ctx.secrets.appSecret ?? '',
      fb_exchange_token: short.access_token,
    });
    const long = await fb<TokenBody>(ctx, `${API_BASE}/oauth/access_token?${longQ}`);

    // 3) só serve se a permissão de publicar em Páginas foi concedida (quando a Meta informa)
    const perms = await fb<{ data?: Array<{ permission: string; status: string }> }>(
      ctx,
      `${API_BASE}/me/permissions?access_token=${long.access_token}`,
    );
    const granted = (perms.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission);
    if (granted.length && !granted.includes('pages_manage_posts')) {
      throw {
        status: 403,
        body: 'permissão de publicação em Páginas não concedida (pages_manage_posts) — refaça a conexão marcando todas as permissões',
      };
    }

    // 4) identidade do usuário (o canal representa a conta; a Página é escolhida por post)
    const me = await fb<{ id: string; name?: string; picture?: { data?: { url?: string } } }>(
      ctx,
      `${API_BASE}/me?fields=id,name,picture&access_token=${long.access_token}`,
    );
    const set = tokenSetFrom(ctx, long, granted);
    return {
      ...set,
      externalId: me.id,
      name: me.name || 'Facebook',
      ...(me.picture?.data?.url ? { avatarUrl: me.picture.data.url } : {}),
      channelSettings: { userId: me.id },
    };
  },

  async refreshToken(ctx, refreshToken) {
    // reapresenta o token longo (ainda válido) ao fb_exchange_token → novo token de ~60 dias.
    // Token que expirou (60 dias sem uso) não volta: o canal cai em REFRESH_REQUIRED (reconectar).
    const q = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: ctx.secrets.appId ?? '',
      client_secret: ctx.secrets.appSecret ?? '',
      fb_exchange_token: refreshToken,
    });
    const t = await fb<TokenBody>(ctx, `${API_BASE}/oauth/access_token?${q}`);
    return tokenSetFrom(ctx, t);
  },

  async listSubAccounts(ctx, token: ConnectedToken): Promise<SubAccount[]> {
    const pages = await fetchPages(ctx, token.accessToken);
    return pages.map((pg) => ({
      externalId: pg.id,
      name: pg.name,
      ...(pg.username ? { username: pg.username } : {}),
      ...(pg.picture?.data?.url ? { avatarUrl: pg.picture.data.url } : {}),
      // grava só o id da Página — o token dela é derivado no publish (nunca vai a settings)
      channelSettings: { pageId: pg.id },
    }));
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    if (!item) return [];
    const { pageId, postType } = (rawSettings ?? {}) as PublishSettings;
    if (!pageId) {
      throw {
        status: 422,
        body: 'Página do Facebook não selecionada. Escolha a Página nas Configurações do post.',
      };
    }
    const pgToken = await pageToken(ctx, token.accessToken, pageId);
    const media = item.media;

    if (postType === 'story') {
      if (media.length === 0) {
        throw { status: 422, body: 'o story do Facebook exige uma foto ou vídeo' };
      }
      // não juntamos várias mídias num story (a Meta cria um story por mídia): barrar >1 evita
      // publicar a 1ª e o retry duplicá-la (mesma decisão do Instagram standalone)
      if (media.length > 1) {
        throw {
          status: 422,
          body: 'story do Facebook aceita uma mídia por vez — agende posts separados',
        };
      }
      const m = media[0]!;
      return [
        m.type === 'video'
          ? await publishVideoStory(ctx, pageId, pgToken, m)
          : await publishPhotoStory(ctx, pageId, pgToken, m),
      ];
    }

    // vídeo único no feed = reel; caso contrário, texto + álbum de fotos (0–10)
    if (media.some((m) => m.type === 'video')) {
      return [await publishVideo(ctx, pageId, pgToken, media[0]!, item.content)];
    }
    return [await publishFeed(ctx, pageId, pgToken, media, item.content)];
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    // a thread vira comentários encadeados: item i responde ao externalId do item i-1 (o post, e
    // depois cada comentário) — comment() do Postiz. Comentário aceita texto + no máx. 1 foto.
    const { pageId } = (rawSettings ?? {}) as PublishSettings;
    if (!pageId) {
      throw { status: 422, body: 'Página do Facebook não selecionada.' };
    }
    const pgToken = await pageToken(ctx, token.accessToken, pageId);
    const first = item.media[0];
    const data = await fbPost<{ id: string; permalink_url?: string }>(
      ctx,
      `/${parentExternalId}/comments`,
      { message: item.content, ...(first ? { attachment_url: first.url } : {}) },
      pgToken,
      'id,permalink_url',
    );
    return { externalId: data.id, ...(data.permalink_url ? { releaseUrl: data.permalink_url } : {}) };
  },

  async validateMedia(items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (i === 0) {
        // feed: álbum de fotos OU 1 vídeo, sem misturar (o allowMixed fica false)
        const verdict = checkMediaRules([item], facebookProvider.capabilities.media);
        if (!verdict.ok) return verdict;
      } else {
        // comentário: só texto ou uma única foto (a Graph API anexa 1 imagem por comentário)
        if (item.media.some((m) => m.type === 'video')) {
          return { ok: false, reason: 'comentário no Facebook não aceita vídeo' };
        }
        if (item.media.length > 1) {
          return { ok: false, reason: 'comentário no Facebook aceita no máximo uma foto' };
        }
      }
    }
    return { ok: true };
  },

  classifyError(status, body) {
    // token expirado/revogado ou autorização de publicação da Página perdida: refresh e, se não der,
    // reconexão manual
    if (
      status === 401 ||
      /Error validating access token|REVOKED_ACCESS_TOKEN|"code":\s*190\b|"code":\s*490\b|1404078|Page publishing authorization/i.test(
        body,
      )
    ) {
      return 'refresh-token';
    }
    // instabilidade da Meta, limites de chamada e "posting too fast"
    if (
      status === 429 ||
      status >= 500 ||
      /1390008|1363047|1609010|An unknown error|"code":\s*[12]\b|rate limit/i.test(body)
    ) {
      return 'transient';
    }
    // o resto é permanente: política de conteúdo, arquivo inválido, foto grande demais, link do FB etc.
    return 'permanent';
  },
};
