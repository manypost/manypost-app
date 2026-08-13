import { z } from 'zod';
import type { ChannelProvider, ProviderContext } from '@manypost/contracts';
import {
  INSTAGRAM_CAROUSEL_MAX,
  INSTAGRAM_MAX_LEN,
  INSTAGRAM_POLL_BUDGET,
  META_LONG_LIVED_FALLBACK_SEC,
  classifyInstagramError,
  igForm,
  makeInstagramGraph,
  validateInstagramMedia,
  type IgPublishTarget,
} from '../shared/instagram-graph';
import { metaFetch } from '../shared/meta-graph';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/instagram.standalone.provider.ts
// e instagram.provider.ts (o standalone delega post/comment ao provider base passando o host
// `graph.instagram.com`). Portado: o OAuth do Instagram Login (token curto → ig_exchange_token →
// token longo, refresh por ig_refresh_token), o fluxo container `/media` → poll `status_code` →
// `/media_publish`, o carrossel por filhos `is_carousel_item` e a taxonomia de erros da Meta — o
// pipeline vive em `shared/instagram-graph.ts`, comum às duas variantes.
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

const graph = makeInstagramGraph(API_BASE);

const settingsSchema = z.object({
  postType: z
    .enum(['feed', 'story'])
    .default('feed')
    .describe(
      'Onde publicar: no feed (foto, reel ou carrossel de até 10) ou como story (uma mídia, some em 24h).',
    ),
});

/** gravado no canal na conexão (channelSettings) e lido do merge canal+publicação no publish */
interface ChannelSettings {
  userId?: string;
  username?: string;
}

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
  const seconds = t.expires_in ?? META_LONG_LIVED_FALLBACK_SEC;
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
  const me = await metaFetch<IgUser>(ctx, `${API_BASE}/me?${q}`);
  if (me?.user_id == null && me?.id == null) {
    throw { status: 502, body: 'o Instagram não retornou o perfil da conta' };
  }
  return me;
}

/** alvo do publish: a própria conta conectada (userId do canal; `me` como fallback) */
const targetFrom = (rawSettings: unknown, accessToken: string): IgPublishTarget => {
  const { userId, username } = (rawSettings ?? {}) as ChannelSettings;
  return {
    publisherId: userId ?? 'me',
    accessToken,
    ...(username ? { username } : {}),
  };
};

export const instagramStandaloneProvider: ChannelProvider = {
  id: 'instagram-standalone',
  name: 'Instagram',
  capabilities: {
    editor: 'plain',
    maxLength: () => INSTAGRAM_MAX_LEN,
    media: {
      // um post = 1 mídia OU carrossel de até 10 itens misturando imagem e vídeo
      images: { maxCount: INSTAGRAM_CAROUSEL_MAX, mimeTypes: ['image/jpeg', 'image/png'] },
      videos: { maxCount: INSTAGRAM_CAROUSEL_MAX, mimeTypes: ['video/mp4', 'video/quicktime'] },
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
    const short = await metaFetch<{
      access_token: string;
      user_id?: string | number;
      permissions?: unknown;
    }>(ctx, TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: igForm({
        client_id: ctx.secrets.appId,
        client_secret: ctx.secrets.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    });
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
    const long = await metaFetch<TokenBody>(ctx, `${OAUTH_BASE}/access_token?${q}`);
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
    const t = await metaFetch<TokenBody>(ctx, `${OAUTH_BASE}/refresh_access_token?${q}`);
    return tokenSetFrom(ctx, t);
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    if (!item) return [];
    const cfg = settingsSchema.parse(rawSettings ?? {});
    const target = targetFrom(rawSettings, token.accessToken);
    const media = item.media;
    const budget = { left: INSTAGRAM_POLL_BUDGET };

    // o Instagram nunca publica sem mídia — o agendamento já barra (requiresMedia), isto é o cinto
    if (media.length === 0) {
      throw { status: 422, body: 'o Instagram exige ao menos uma imagem ou vídeo' };
    }

    if (cfg.postType === 'story') {
      // não existe carrossel de story: barrar >1 evita publicar o 1º e o retry duplicá-lo
      if (media.length > 1) {
        throw {
          status: 422,
          body: 'story do Instagram aceita uma mídia por vez — agende posts separados',
        };
      }
      return [await graph.publishStory(ctx, target, media[0]!, budget)];
    }

    if (media.length === 1) {
      return [await graph.publishSingle(ctx, target, media[0]!, item.content, budget)];
    }
    return [await graph.publishCarousel(ctx, target, media, item.content, budget)];
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    // no Instagram a thread vira comentários no post raiz (só texto) — comment() do Postiz
    return graph.comment(ctx, targetFrom(rawSettings, token.accessToken), parentExternalId, item.content);
  },

  async validateMedia(items) {
    return validateInstagramMedia(items, instagramStandaloneProvider.capabilities.media);
  },

  classifyError(status, body) {
    return classifyInstagramError(status, body);
  },
};
