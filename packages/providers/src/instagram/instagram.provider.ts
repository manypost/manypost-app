import { z } from 'zod';
import type {
  ChannelProvider,
  ConnectedToken,
  ProviderContext,
  SubAccount,
} from '@manypost/contracts';
import {
  INSTAGRAM_CAROUSEL_MAX,
  INSTAGRAM_MAX_LEN,
  INSTAGRAM_POLL_BUDGET,
  META_LONG_LIVED_FALLBACK_SEC,
  classifyInstagramError,
  makeInstagramGraph,
  validateInstagramMedia,
  type IgPublishTarget,
} from '../shared/instagram-graph';
import { GRAPH_BASE, fetchPages, metaFetch } from '../shared/meta-graph';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/instagram.provider.ts
// Portado: o OAuth do Facebook Login (code → token curto → fb_exchange_token → token longo ~60d), a
// resolução da conta do Instagram pela Página (`instagram_business_account`), o fluxo container
// `/media` → poll `status_code` → `/media_publish`, o carrossel por filhos `is_carousel_item` e a
// taxonomia de erros da Meta. O pipeline container/poll/publish/permalink vive em
// `shared/instagram-graph.ts`, comum às duas variantes.
//
// Esta é a variante **via Facebook Business** — irmã do `instagram-standalone` (Instagram Login puro),
// exatamente como o Postiz mantém dois `identifier` separados e como já fizemos com
// `discord` × `discord-webhook`. Ela usa a MESMA app Meta do `facebook` (FACEBOOK_APP_*).
//
// Divergências de propósito (as mesmas do nosso facebook/instagram-standalone): ctx injetado (nada de
// env global nem fetch global), settings tipados por Zod, parâmetros no CORPO do POST (o Postiz monta
// query string) e story de mídia ÚNICA (o Postiz publica um story por mídia, o que duplicaria no
// retry). O ponto central do desenho — herdado do `facebook` da onda 16 — é que a **Página é escolhida
// por post** (sub-contas, padrão do Discord) e o **token da Página é derivado no publish**: settings é
// jsonb sem cifra, e token ali seria vazamento. Aqui a derivação rende duas coisas numa chamada só
// (`?fields=access_token,instagram_business_account`): o token de publicação e o id da conta IG.
// Permalink best-effort: depois do `media_publish` o post já está na rede e nada pode lançar (senão a
// máquina de estados retentaria e repostaria).

const API_BASE = GRAPH_BASE;
const AUTHORIZE_URL = 'https://www.facebook.com/v20.0/dialog/oauth';
const SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
  'instagram_manage_comments',
  'instagram_manage_insights',
];
/** campos das Páginas na listagem de sub-contas — inclui a conta IG vinculada a cada uma */
const PAGE_FIELDS = 'id,name,username,picture.type(large),instagram_business_account';

const graph = makeInstagramGraph(API_BASE);

const settingsSchema = z.object({
  // OBRIGATÓRIO (padrão do Discord/facebook): a conta é escolhida por post no composer
  // (SubAccountsField lista as Páginas com Instagram vinculado). O valor é o id da PÁGINA — é dele
  // que saem, no publish, o token de publicação e o id da conta do Instagram.
  pageId: z
    .string()
    .min(1)
    .describe(
      'Conta do Instagram onde publicar — escolha entre as contas profissionais vinculadas às suas Páginas do Facebook.',
    ),
  postType: z
    .enum(['feed', 'story'])
    .default('feed')
    .describe(
      'Onde publicar: no feed (foto, reel ou carrossel de até 10) ou como story (uma mídia, some em 24h).',
    ),
});

/** settings de publicação lidos do merge canal+publicação (o zod não-strict descarta o resto). */
interface PublishSettings {
  pageId?: string;
  postType?: 'feed' | 'story';
}

interface TokenBody {
  access_token: string;
  expires_in?: number;
}

/**
 * TokenSet do Facebook Login: **não existe refresh token separado** — o token longo é reapresentado
 * ao `fb_exchange_token` para renovar, então guardamos o mesmo valor nos dois campos (é o que faz o
 * worker persistir a rotação). Mesmo modelo do Threads/Instagram standalone/Facebook.
 */
function tokenSetFrom(ctx: ProviderContext, t: TokenBody, scopes?: string[]) {
  const seconds = t.expires_in ?? META_LONG_LIVED_FALLBACK_SEC;
  return {
    accessToken: t.access_token,
    refreshToken: t.access_token,
    expiresAt: new Date(ctx.now().getTime() + seconds * 1000).toISOString(),
    scopes: scopes?.length ? scopes : SCOPES,
  };
}

/**
 * Resolve, a partir do id da Página escolhida no post, tudo que o publish precisa — numa chamada só.
 * O token da Página é derivado a cada publicação (sempre fresco) e **nunca é gravado em settings**,
 * que é jsonb sem cifra. `publisherId` é a conta profissional do Instagram vinculada à Página.
 */
async function resolveTarget(
  ctx: ProviderContext,
  userToken: string,
  pageId: string,
): Promise<IgPublishTarget> {
  const q = new URLSearchParams({
    fields: 'access_token,instagram_business_account{id,username}',
    access_token: userToken,
  });
  const page = await metaFetch<{
    access_token?: string;
    instagram_business_account?: { id?: string; username?: string };
  }>(ctx, `${API_BASE}/${pageId}?${q}`);

  if (!page.access_token) {
    throw {
      status: 403,
      body: 'sem token de publicação para esta Página — confirme que você a administra e reconecte',
    };
  }
  const igUserId = page.instagram_business_account?.id;
  if (!igUserId) {
    throw {
      status: 422,
      body: 'esta Página do Facebook não tem uma conta profissional do Instagram vinculada — vincule a conta nas configurações da Página e escolha-a de novo',
    };
  }
  return {
    publisherId: igUserId,
    accessToken: page.access_token,
    ...(page.instagram_business_account?.username
      ? { username: page.instagram_business_account.username }
      : {}),
  };
}

export const instagramProvider: ChannelProvider = {
  id: 'instagram',
  name: 'Instagram (Facebook Business)',
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
    // Derived from Postiz (AGPL-3.0): maxConcurrentJob = 400. Nossa semântica de maxConcurrent é
    // semáforo por provider; um teto modesto basta. Limite documentado da API: ~25 posts
    // publicados por conta em 24h (erro 2207042) — o mesmo do standalone.
    maxConcurrent: 3,
    perChannelWindow: { limit: 25, windowSec: 86_400 },
  },
  settingsSchema,
  // mesma app Meta do `facebook` (o produto "Facebook Login" cobre as duas redes)
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
    const short = await metaFetch<TokenBody>(ctx, `${API_BASE}/oauth/access_token?${shortQ}`);

    // 2) token curto → token LONGO (~60 dias) por fb_exchange_token; é ele que fica cifrado no canal
    const longQ = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: ctx.secrets.appId ?? '',
      client_secret: ctx.secrets.appSecret ?? '',
      fb_exchange_token: short.access_token,
    });
    const long = await metaFetch<TokenBody>(ctx, `${API_BASE}/oauth/access_token?${longQ}`);

    // 3) só serve se a permissão de publicar no Instagram foi concedida (quando a Meta informa)
    const perms = await metaFetch<{ data?: Array<{ permission: string; status: string }> }>(
      ctx,
      `${API_BASE}/me/permissions?access_token=${long.access_token}`,
    );
    const granted = (perms.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission);
    if (granted.length && !granted.includes('instagram_content_publish')) {
      throw {
        status: 403,
        body: 'permissão de publicação no Instagram não concedida (instagram_content_publish) — refaça a conexão marcando todas as permissões',
      };
    }

    // 4) identidade do usuário do Facebook (o canal representa a conta; a conta IG é escolhida
    //    por post, via a Página — mesmo desenho do provider `facebook`)
    const me = await metaFetch<{ id: string; name?: string; picture?: { data?: { url?: string } } }>(
      ctx,
      `${API_BASE}/me?fields=id,name,picture&access_token=${long.access_token}`,
    );
    const set = tokenSetFrom(ctx, long, granted);
    return {
      ...set,
      externalId: me.id,
      name: me.name || 'Instagram',
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
    const t = await metaFetch<TokenBody>(ctx, `${API_BASE}/oauth/access_token?${q}`);
    return tokenSetFrom(ctx, t);
  },

  async listSubAccounts(ctx, token: ConnectedToken): Promise<SubAccount[]> {
    const pages = await fetchPages(ctx, token.accessToken, PAGE_FIELDS);
    // só Páginas COM conta profissional do Instagram vinculada — as demais não publicam aqui
    const withIg = pages.filter((pg) => pg.instagram_business_account?.id);

    return Promise.all(
      withIg.map(async (pg) => {
        const igId = pg.instagram_business_account!.id;
        // o rótulo é a conta do INSTAGRAM (é ela que a pessoa reconhece), mas o valor gravado no
        // settings é o id da PÁGINA — dele saem o token e o id da conta IG no publish
        let ig: { username?: string; name?: string; profile_picture_url?: string } = {};
        try {
          const q = new URLSearchParams({
            fields: 'username,name,profile_picture_url',
            access_token: token.accessToken,
          });
          ig = await metaFetch(ctx, `${API_BASE}/${igId}?${q}`);
        } catch {
          // conta IG sem detalhe legível — a Página ainda serve, cai no nome dela
        }
        const handle = ig.username ? `@${ig.username}` : undefined;
        return {
          externalId: pg.id,
          name: handle ?? ig.name ?? pg.name,
          ...(ig.username ? { username: ig.username } : {}),
          ...(ig.profile_picture_url
            ? { avatarUrl: ig.profile_picture_url }
            : pg.picture?.data?.url
              ? { avatarUrl: pg.picture.data.url }
              : {}),
          // grava só o id da Página — o token dela é derivado no publish (nunca vai a settings)
          channelSettings: { pageId: pg.id },
        };
      }),
    );
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    if (!item) return [];
    const { pageId, postType } = (rawSettings ?? {}) as PublishSettings;
    if (!pageId) {
      throw {
        status: 422,
        body: 'Conta do Instagram não selecionada. Escolha a conta nas Configurações do post.',
      };
    }
    const media = item.media;

    // o que não depende da rede falha ANTES de qualquer chamada à Meta:
    // o Instagram nunca publica sem mídia — o agendamento já barra (requiresMedia), isto é o cinto
    if (media.length === 0) {
      throw { status: 422, body: 'o Instagram exige ao menos uma imagem ou vídeo' };
    }
    // não existe carrossel de story: barrar >1 evita publicar o 1º e o retry duplicá-lo
    if (postType === 'story' && media.length > 1) {
      throw {
        status: 422,
        body: 'story do Instagram aceita uma mídia por vez — agende posts separados',
      };
    }

    const target = await resolveTarget(ctx, token.accessToken, pageId);
    const budget = { left: INSTAGRAM_POLL_BUDGET };

    if (postType === 'story') {
      return [await graph.publishStory(ctx, target, media[0]!, budget)];
    }
    if (media.length === 1) {
      return [await graph.publishSingle(ctx, target, media[0]!, item.content, budget)];
    }
    return [await graph.publishCarousel(ctx, target, media, item.content, budget)];
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    // no Instagram a thread vira comentários no post raiz (só texto) — comment() do Postiz
    const { pageId } = (rawSettings ?? {}) as PublishSettings;
    if (!pageId) {
      throw { status: 422, body: 'Conta do Instagram não selecionada.' };
    }
    const target = await resolveTarget(ctx, token.accessToken, pageId);
    return graph.comment(ctx, target, parentExternalId, item.content);
  },

  async validateMedia(items) {
    return validateInstagramMedia(items, instagramProvider.capabilities.media);
  },

  classifyError(status, body) {
    // além da taxonomia comum: autorização de publicação da Página perdida também pede reconexão
    return classifyInstagramError(status, body, { alsoRefresh: /Page publishing authorization/i });
  },
};
