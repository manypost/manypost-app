import { z } from 'zod';
import type {
  ChannelProvider,
  MediaRef,
  ProviderContext,
  PublishResult,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/threads.provider.ts
// (fluxo container → poll de status → threads_publish, trocas th_exchange_token/th_refresh_token,
// carrossel por filhos is_carousel_item e a taxonomia de erros da Meta). Divergências de propósito:
// ctx injetado (nada de env global), settings tipados por Zod, alt_text no container, parâmetros no
// CORPO do POST (o Postiz monta tudo em query string) e permalink best-effort — depois do
// threads_publish o post já está na rede, então nada mais pode lançar (retry reposta).
// Traga-sua-chave: THREADS_APP_ID/THREADS_APP_SECRET vêm do env do self-hoster.

const AUTHORIZE_URL = 'https://www.threads.net/oauth/authorize';
/** endpoints de token vivem FORA da versão: /oauth/access_token, /access_token, /refresh_access_token */
const OAUTH_BASE = 'https://graph.threads.net';
const API_BASE = 'https://graph.threads.net/v1.0';
const SCOPES = [
  'threads_basic',
  'threads_content_publish',
  'threads_manage_replies',
  'threads_manage_insights',
];
const MAX_LEN = 500;
/** carrossel do Threads: 2 a 20 itens, imagens e vídeos podem se misturar no mesmo post */
const CAROUSEL_MAX = 20;
/** o token longo do Threads dura ~60 dias (a resposta traz expires_in; isto é só o piso do fallback) */
const LONG_LIVED_FALLBACK_SEC = 60 * 24 * 3600;

// A Meta processa mídia em segundo plano: o container só pode ser publicado em FINISHED. O
// orçamento de polls é COMPARTILHADO por publicação (pai + filhos do carrossel) para o total
// ficar abaixo do watchdog de zumbis (15 min) mesmo num carrossel de 20 vídeos.
const POLL_INTERVAL_MS = 3_000;
const POLL_BUDGET = 140; // ~7 min somados

const settingsSchema = z.object({
  replyControl: z
    .enum(['everyone', 'accounts_you_follow', 'mentioned_only'])
    .default('everyone')
    .describe(
      'Quem pode responder: qualquer pessoa, apenas perfis que você segue ou apenas perfis mencionados no post.',
    ),
  linkAttachment: z
    .string()
    .url()
    .optional()
    .describe('Link em destaque no post (a prévia só aparece em posts somente de texto).'),
});

type Settings = z.infer<typeof settingsSchema>;

/** gravado no canal na conexão (channelSettings) e lido do merge canal+publicação no publish */
interface ChannelSettings {
  userId?: string;
  username?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Chamada à Graph API do Threads. Erro da Meta é `{ error: { message, type, code, error_subcode } }`;
 * os endpoints de token às vezes devolvem esse envelope com HTTP 200, por isso checamos o corpo
 * também. O corpo cru vai no throw para o classifyError casar código e mensagem.
 */
async function th<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  const json = (text ? JSON.parse(text) : {}) as { error?: unknown };
  if (json.error) throw { status: 400, body: text.slice(0, 2000) };
  return json as T;
}

/** corpo form-urlencoded sem chaves vazias (post só com mídia não manda `text`). */
const form = (params: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as Array<[string, string]>,
  );

const apiPost = <T>(
  ctx: ProviderContext,
  path: string,
  params: Record<string, string | undefined>,
): Promise<T> =>
  th<T>(ctx, `${API_BASE}${path}`, {
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
 * TokenSet do Threads: **não existe refresh token separado** — o próprio token longo é
 * apresentado ao /refresh_access_token, então guardamos o mesmo valor nos dois campos
 * (é o que faz o worker persistir a rotação a cada renovação).
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

interface ThreadsUser {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
}

async function fetchUser(ctx: ProviderContext, accessToken: string): Promise<ThreadsUser> {
  const q = new URLSearchParams({
    fields: 'id,username,name,threads_profile_picture_url',
    access_token: accessToken,
  });
  const me = await th<ThreadsUser>(ctx, `${API_BASE}/me?${q}`);
  if (!me?.id) throw { status: 502, body: 'o Threads não retornou o perfil da conta' };
  return me;
}

/** IMAGE/VIDEO + a URL pública correspondente: a Meta faz *pull* da mídia (não subimos bytes). */
const mediaParams = (m: MediaRef): Record<string, string | undefined> => ({
  media_type: m.type === 'video' ? 'VIDEO' : 'IMAGE',
  ...(m.type === 'video' ? { video_url: m.url } : { image_url: m.url }),
  ...(m.alt ? { alt_text: m.alt } : {}),
});

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
    const q = new URLSearchParams({ fields: 'status,error_message', access_token: accessToken });
    const { status, error_message } = await th<{ status?: string; error_message?: string }>(
      ctx,
      `${API_BASE}/${containerId}?${q}`,
    );
    // container de texto nasce pronto; sem campo `status` não há o que esperar
    if (!status || status === 'FINISHED' || status === 'PUBLISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw { status: 422, body: error_message ?? `o Threads recusou a mídia (${status})` };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw { status: 504, body: 'o Threads demorou demais para processar a mídia' };
}

interface ContainerInput {
  userId: string;
  text: string;
  media: MediaRef[];
  cfg: Settings;
  replyToId?: string;
  budget: { left: number };
}

/** Cria o container de publicação: TEXT, mídia única (IMAGE/VIDEO) ou CAROUSEL com filhos. */
async function createContainer(
  ctx: ProviderContext,
  accessToken: string,
  o: ContainerInput,
): Promise<string> {
  const base = {
    access_token: accessToken,
    reply_control: o.cfg.replyControl,
    ...(o.replyToId ? { reply_to_id: o.replyToId } : {}),
  };

  if (o.media.length === 0) {
    const { id } = await apiPost<{ id: string }>(ctx, `/${o.userId}/threads`, {
      ...base,
      media_type: 'TEXT',
      text: o.text,
      // a prévia de link só existe em post sem mídia
      link_attachment: o.cfg.linkAttachment,
    });
    return id;
  }

  if (o.media.length === 1) {
    const { id } = await apiPost<{ id: string }>(ctx, `/${o.userId}/threads`, {
      ...base,
      ...mediaParams(o.media[0]!),
      text: o.text,
    });
    return id;
  }

  // carrossel: cada filho é um container SEM texto/reply_control (só o pai carrega isso)
  const children: string[] = [];
  for (const m of o.media) {
    const { id } = await apiPost<{ id: string }>(ctx, `/${o.userId}/threads`, {
      access_token: accessToken,
      is_carousel_item: 'true',
      ...mediaParams(m),
    });
    children.push(id);
  }
  // os filhos precisam estar processados ANTES de virar carrossel
  for (const id of children) await waitContainer(ctx, accessToken, id, o.budget);

  const { id } = await apiPost<{ id: string }>(ctx, `/${o.userId}/threads`, {
    ...base,
    media_type: 'CAROUSEL',
    children: children.join(','),
    text: o.text,
  });
  return id;
}

async function publishContainer(
  ctx: ProviderContext,
  accessToken: string,
  userId: string,
  creationId: string,
  username: string | undefined,
  budget: { left: number },
): Promise<PublishResult> {
  await waitContainer(ctx, accessToken, creationId, budget);
  const { id: threadId } = await apiPost<{ id: string }>(ctx, `/${userId}/threads_publish`, {
    access_token: accessToken,
    creation_id: creationId,
  });

  // DAQUI PARA BAIXO o post JÁ ESTÁ na rede: lançar faria a máquina de estados retentar e
  // repostar. O permalink é enfeite — falhou, cai no perfil (ou fica sem URL).
  let permalink: string | undefined;
  try {
    const q = new URLSearchParams({ fields: 'id,permalink', access_token: accessToken });
    permalink = (await th<{ permalink?: string }>(ctx, `${API_BASE}/${threadId}?${q}`)).permalink;
  } catch {
    permalink = undefined;
  }
  const releaseUrl =
    permalink ?? (username ? `https://www.threads.net/@${username.replace(/^@/, '')}` : undefined);
  return { externalId: threadId, ...(releaseUrl ? { releaseUrl } : {}) };
}

export const threadsProvider: ChannelProvider = {
  id: 'threads',
  name: 'Threads',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_LEN,
    media: {
      // um post pode ter 1 mídia OU um carrossel de até 20 itens misturando imagem e vídeo
      images: { maxCount: CAROUSEL_MAX, mimeTypes: ['image/jpeg', 'image/png'] },
      videos: { maxCount: CAROUSEL_MAX, mimeTypes: ['video/mp4', 'video/quicktime'] },
    },
    threads: true, // réplicas nativas (reply_to_id) — é a rede que nasceu para isso
    mentions: false,
    analytics: false, // threads_insights fica p/ a fatia de analytics
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    // Derived from Postiz (AGPL-3.0): maxConcurrentJob = 2. Teto documentado da API: 250 posts/24h por conta.
    maxConcurrent: 2,
    perChannelWindow: { limit: 250, windowSec: 86_400 },
  },
  settingsSchema,
  requiredSecrets: ['appId', 'appSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const q = new URLSearchParams({
      client_id: ctx.secrets.appId ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(','), // a Meta separa escopos por vírgula
      state,
    });
    return { url: `${AUTHORIZE_URL}?${q}`, state };
  },

  async exchangeCode(ctx, { code, redirectUri }) {
    // 1) code → token curto (1h) + user_id
    const short = await th<{ access_token: string; user_id?: string | number; permissions?: string[] }>(
      ctx,
      `${OAUTH_BASE}/oauth/access_token`,
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
    if (short.permissions?.length && !short.permissions.includes('threads_content_publish')) {
      throw {
        status: 403,
        body: 'permissão de publicação não concedida (threads_content_publish) — refaça a conexão marcando todas as permissões',
      };
    }

    // 2) token curto → token LONGO (~60 dias); é ele que fica cifrado no canal
    const q = new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: ctx.secrets.appSecret ?? '',
      access_token: short.access_token,
    });
    const long = await th<TokenBody>(ctx, `${OAUTH_BASE}/access_token?${q}`);
    const set = tokenSetFrom(ctx, {
      ...long,
      ...(short.permissions?.length ? { permissions: short.permissions } : {}),
    });

    const me = await fetchUser(ctx, set.accessToken);
    const userId = String(me.id ?? short.user_id);
    return {
      ...set,
      externalId: userId,
      name: me.name || me.username || 'Threads',
      ...(me.username ? { username: me.username } : {}),
      ...(me.threads_profile_picture_url ? { avatarUrl: me.threads_profile_picture_url } : {}),
      // userId endereça /{userId}/threads no publish; username monta a releaseUrl de fallback
      channelSettings: { userId, ...(me.username ? { username: me.username } : {}) },
    };
  },

  async refreshToken(ctx, refreshToken) {
    // th_refresh_token estende por mais ~60 dias; só funciona com token VÁLIDO e com >24h de vida.
    // Token que expirou (60 dias sem uso) não volta: o canal cai em REFRESH_REQUIRED (reconectar).
    const q = new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: refreshToken,
    });
    const t = await th<TokenBody>(ctx, `${OAUTH_BASE}/refresh_access_token?${q}`);
    return tokenSetFrom(ctx, t);
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    if (!item) return [];
    // userId/username vêm do settings do CANAL (merge) — o zod não-strict os descarta no parse
    const { userId, username } = (rawSettings ?? {}) as ChannelSettings;
    const cfg = settingsSchema.parse(rawSettings ?? {});
    const budget = { left: POLL_BUDGET };
    const uid = userId ?? 'me';
    const creationId = await createContainer(ctx, token.accessToken, {
      userId: uid,
      text: item.content,
      media: item.media,
      cfg,
      budget,
    });
    return [await publishContainer(ctx, token.accessToken, uid, creationId, username, budget)];
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    const { userId, username } = (rawSettings ?? {}) as ChannelSettings;
    const cfg = settingsSchema.parse(rawSettings ?? {});
    const budget = { left: POLL_BUDGET };
    const uid = userId ?? 'me';
    const creationId = await createContainer(ctx, token.accessToken, {
      userId: uid,
      text: item.content,
      media: item.media,
      cfg,
      replyToId: parentExternalId,
      budget,
    });
    return publishContainer(ctx, token.accessToken, uid, creationId, username, budget);
  },

  async validateMedia(items) {
    for (const item of items) {
      if (item.media.length > CAROUSEL_MAX) {
        return { ok: false, reason: `máximo de ${CAROUSEL_MAX} itens por post no Threads` };
      }
    }
    // carrossel do Threads aceita imagem e vídeo no mesmo post (allowMixed)
    return checkMediaRules(items, threadsProvider.capabilities.media, { allowMixed: true });
  },

  classifyError(status, body) {
    // token expirado/revogado ou permissão faltando: refresh e, se não der, reconexão manual
    if (status === 401 || /Error validating access token|OAuthException|"code":\s*190/i.test(body)) {
      return 'refresh-token';
    }
    // limite de chamadas da app/usuário e instabilidade da Meta
    if (status === 429 || status >= 500 || /"code":\s*(4|17|32|613)\b|rate limit/i.test(body)) {
      return 'transient';
    }
    // o resto é permanente: 2207051 (atividade restringida), 4279013 (usuário restrito),
    // "The media could not be fetched from this URI" (URL não pública) e texto > 500 chars
    return 'permanent';
  },
};
