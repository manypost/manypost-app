import { z } from 'zod';
import type {
  ChannelProvider,
  ProviderContext,
  PublishItem,
  PublishResult,
  TokenSet,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';
import {
  SHORTS_MAX_DURATION_SEC,
  isVerticalEnoughForShorts,
  parseVideoGeometry,
  type VideoGeometry,
} from './mp4-geometry';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts
// Portado: o fluxo OAuth do Google com access_type=offline, a resolução do canal por channels.list,
// o corpo de metadados do videos.insert (snippet/status), o thumbnails.set best-effort e boa parte
// da taxonomia de erros por `reason` da API.
//
// Divergências de propósito (ver openspec/changes/add-youtube-provider/design.md):
// (1) ctx injetado — nada de `googleapis` nem de process.env, porque o SDK traz o próprio cliente
//     HTTP e não passa pelo ctx.fetch que torna todo provider daqui testável;
// (2) DOIS escopos sensíveis em vez de oito — o Postiz pede `youtube`, `youtube.force-ssl` e
//     `youtubepartner`, que ampliam a verificação do Google sem que usemos nada deles;
// (3) upload resumível dirigido na mão, com o corpo em streaming — o Postiz entrega uma stream ao
//     SDK e o TikTok daqui carrega o arquivo inteiro na memória; nenhum dos dois serve para vídeo;
// (4) geometria lida do container para decidir Short × vídeo, porque a API não tem esse parâmetro.
//
// Traga-sua-chave: YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET vêm do env do self-hoster.

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';
const ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2';

/** O mínimo que publica e nomeia o canal. Cada escopo sensível a mais é revisado pelo Google. */
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];
/** Só entra quando a instalação liga métricas (YOUTUBE_ENABLE_ANALYTICS) — ver design.md. */
const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/yt-analytics.readonly';

/** teto da descrição do vídeo no YouTube */
const MAX_LEN = 5000;
const TITLE_MAX = 100;
/** o YouTube soma o comprimento de TODAS as tags e cobra 2 caracteres a mais por tag com espaço */
const TAGS_MAX_TOTAL = 500;
/** "People & Blogs": categoria válida em toda região — categoria inválida é recusa dura */
const DEFAULT_CATEGORY_ID = '22';
/** prefixo lido para achar o `moov` de um export faststart */
const PROBE_BYTES = 2 * 1024 * 1024;

export function tagsLength(tags: string[]): number {
  return tags.reduce((total, tag) => total + tag.length + (/\s/.test(tag) ? 2 : 0), 0);
}

const settingsSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(TITLE_MAX)
    .describe('Título do vídeo no YouTube — obrigatório, até 100 caracteres.'),
  privacyStatus: z
    .enum(['public', 'unlisted', 'private'])
    .default('public')
    .describe(
      'Visibilidade do vídeo. Enquanto o projeto no Google não passar pela auditoria de conformidade, o YouTube força todo envio por API como Privado, mesmo pedindo Público.',
    ),
  categoryId: z
    .string()
    .default(DEFAULT_CATEGORY_ID)
    .describe('Categoria do vídeo no YouTube (padrão: 22, "Pessoas e blogs").'),
  selfDeclaredMadeForKids: z
    .boolean()
    .default(false)
    .describe(
      'Conteúdo feito para crianças. É uma declaração legal exigida pelo YouTube (COPPA) e vai em toda publicação.',
    ),
  tags: z
    .array(z.string().min(1))
    .default([])
    .refine((t) => tagsLength(t) <= TAGS_MAX_TOTAL, {
      message: `a soma das tags passa de ${TAGS_MAX_TOTAL} caracteres (o YouTube cobra 2 a mais por tag com espaço)`,
    })
    .describe('Tags do vídeo. O YouTube limita a soma de todas a 500 caracteres.'),
  shortsIntent: z
    .enum(['auto', 'short', 'video'])
    .default('auto')
    .describe(
      'O YouTube não tem parâmetro de Short: ele classifica pelo próprio arquivo (vertical e até 3 minutos vira Short). Escolha "auto" para aceitar o que sair, ou trave em Short/vídeo comum para o manypost recusar antes de enviar se o arquivo não corresponder.',
    ),
  thumbnailUrl: z
    .string()
    .url()
    .optional()
    .describe(
      'Miniatura personalizada (URL). Exige conta verificada no YouTube; se for recusada, o vídeo é publicado assim mesmo.',
    ),
  publishAt: z
    .string()
    .datetime()
    .optional()
    .describe(
      'Liberar o vídeo automaticamente neste instante (o vídeo sobe como privado até lá). Opcional — sem isso, o vídeo já sai com a visibilidade escolhida.',
    ),
});

type Settings = z.infer<typeof settingsSchema>;

/** Erro da API do Google: `{ error: { code, message, errors: [{ reason }] } }`. */
async function google<T>(ctx: ProviderContext, url: string, init?: RequestInit): Promise<T> {
  const res = await ctx.fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  return (text ? JSON.parse(text) : {}) as T;
}

interface TokenBody {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function oauthToken(ctx: ProviderContext, params: Record<string, string>): Promise<TokenSet> {
  const res = await ctx.fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...params,
      client_id: ctx.secrets.clientId ?? '',
      client_secret: ctx.secrets.clientSecret ?? '',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  const t = JSON.parse(text) as TokenBody;
  if (t.error) throw { status: 400, body: `${t.error}: ${t.error_description ?? ''}` };
  return {
    accessToken: t.access_token,
    ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
    expiresAt: new Date(ctx.now().getTime() + t.expires_in * 1000).toISOString(),
    scopes: t.scope?.split(' ').filter(Boolean) ?? [],
  };
}

interface ChannelItem {
  id: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
  };
}

/**
 * O canal do token. `mine=true` devolve UM canal: o Google amarra o token ao canal escolhido no
 * seletor de contas durante o consentimento — por isso o canal é identidade da conexão, e não um
 * campo por post (design.md).
 */
async function fetchOwnChannel(ctx: ProviderContext, accessToken: string): Promise<ChannelItem> {
  const json = await google<{ items?: ChannelItem[] }>(
    ctx,
    `${API_BASE}/channels?part=snippet&mine=true`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  const channel = json.items?.[0];
  if (!channel?.id) {
    throw {
      status: 422,
      body: 'esta conta do Google não tem canal no YouTube — crie o canal e conecte de novo',
    };
  }
  return channel;
}

/**
 * Lê o começo do arquivo para medir o vídeo. Requisição própria com Range: o corpo do upload é
 * enviado em streaming e não pode ser consumido duas vezes.
 */
async function probeGeometry(
  ctx: ProviderContext,
  url: string,
): Promise<VideoGeometry | undefined> {
  try {
    const res = await ctx.fetch(url, {
      headers: { range: `bytes=0-${PROBE_BYTES - 1}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok || !res.body) return undefined;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < PROBE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    // servidor que ignora o Range devolveria o arquivo inteiro — paramos no prefixo e cortamos
    await reader.cancel().catch(() => {});

    const head = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      head.set(c, at);
      at += c.byteLength;
    }
    return parseVideoGeometry(head);
  } catch {
    // medir é best-effort; quem decide se a ausência é fatal é o enforceShortsIntent
    return undefined;
  }
}

/**
 * O YouTube não expõe parâmetro de Short — ele classifica pelo arquivo. Então a única forma
 * honesta de honrar "publicar como Short" é medir antes e recusar quando o arquivo não permite.
 */
export function enforceShortsIntent(
  intent: Settings['shortsIntent'],
  geometry: VideoGeometry | undefined,
): { ok: true; willBeShort?: boolean } | { ok: false; reason: string } {
  if (!geometry) {
    if (intent === 'auto') return { ok: true };
    return {
      ok: false,
      reason:
        'não foi possível medir o vídeo (proporção e duração) para garantir o formato escolhido — use "deixar o YouTube decidir" ou envie um MP4/MOV',
    };
  }

  const vertical = isVerticalEnoughForShorts(geometry);
  const withinShortDuration = geometry.durationSec <= SHORTS_MAX_DURATION_SEC;
  const willBeShort = vertical && withinShortDuration;

  if (intent === 'short' && !willBeShort) {
    const why = !vertical
      ? `o vídeo é horizontal (${geometry.width}x${geometry.height}) e um Short precisa ser vertical ou quadrado`
      : `o vídeo tem ${Math.round(geometry.durationSec)}s e um Short vai até ${SHORTS_MAX_DURATION_SEC}s`;
    return { ok: false, reason: `${why} — o YouTube publicaria como vídeo comum` };
  }
  if (intent === 'video' && willBeShort) {
    return {
      ok: false,
      reason: `o vídeo é vertical (${geometry.width}x${geometry.height}) e tem ${Math.round(geometry.durationSec)}s, então o YouTube o classificaria como Short — corte para menos de ${SHORTS_MAX_DURATION_SEC}s não resolve, use um vídeo horizontal ou escolha "deixar o YouTube decidir"`,
    };
  }
  return { ok: true, willBeShort };
}

/** Corpo de metadados do videos.insert — golden por rede (SPEC_INTEGRATIONS §7). */
export function buildVideoMetadata(cfg: Settings, item: PublishItem, now: Date): unknown {
  // publishAt exige privacyStatus=private enquanto vale; um instante já vencido é ignorado
  const scheduled = cfg.publishAt && new Date(cfg.publishAt).getTime() > now.getTime();
  return {
    snippet: {
      title: cfg.title,
      description: item.content.slice(0, MAX_LEN),
      categoryId: cfg.categoryId,
      ...(cfg.tags.length ? { tags: cfg.tags } : {}),
    },
    status: {
      privacyStatus: scheduled ? 'private' : cfg.privacyStatus,
      selfDeclaredMadeForKids: cfg.selfDeclaredMadeForKids,
      ...(scheduled ? { publishAt: cfg.publishAt } : {}),
    },
  };
}

interface VideoResource {
  id?: string;
  status?: { privacyStatus?: string; uploadStatus?: string };
}

/**
 * Upload resumível em duas etapas. O corpo do PUT é a stream da mídia — o arquivo nunca fica
 * inteiro na memória do worker, que é o motivo de não reaproveitar o caminho do TikTok.
 */
async function uploadVideo(
  ctx: ProviderContext,
  accessToken: string,
  metadata: unknown,
  media: { url: string; mime: string },
): Promise<VideoResource> {
  // UMA requisição à origem: o Content-Length sai do cabeçalho desta resposta e o corpo dela é o
  // que vai no PUT. Um HEAD antes seria mais arrumado, mas nem todo storage responde a HEAD (o
  // driver local serve arquivo estático), e um HEAD recusado derrubaria a publicação sem motivo.
  const source = await ctx.fetch(media.url, { signal: AbortSignal.timeout(120_000) });
  if (!source.ok || !source.body) {
    throw { status: 422, body: `vídeo inacessível para o worker: HTTP ${source.status}` };
  }
  const size = Number(source.headers.get('content-length'));
  if (!Number.isFinite(size) || size <= 0) {
    await source.body.cancel().catch(() => {});
    throw {
      status: 422,
      body: `a origem do vídeo não declarou o tamanho (Content-Length) em ${media.url} — o upload resumível do YouTube exige o tamanho antes de abrir a sessão`,
    };
  }

  const init = await ctx.fetch(`${UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(size),
      'x-upload-content-type': media.mime,
    },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) {
    await source.body.cancel().catch(() => {});
    throw { status: init.status, body: (await init.text()).slice(0, 2000) };
  }
  const session = init.headers.get('location');
  if (!session) {
    await source.body.cancel().catch(() => {});
    throw { status: 502, body: 'o YouTube não devolveu a URL da sessão de upload' };
  }

  const put = await ctx.fetch(session, {
    method: 'PUT',
    headers: { 'content-type': media.mime, 'content-length': String(size) },
    body: source.body,
    // corpo em stream: o runtime exige declarar que só o pedido é half-duplex
    duplex: 'half',
  } as RequestInit);
  const text = await put.text();
  if (!put.ok) throw { status: put.status, body: text.slice(0, 2000) };

  const video = (text ? JSON.parse(text) : {}) as VideoResource;
  if (!video.id) throw { status: 502, body: 'o YouTube aceitou o upload mas não devolveu o id do vídeo' };
  return video;
}

export const youtubeProvider: ChannelProvider = {
  id: 'youtube',
  name: 'YouTube',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_LEN,
    media: {
      // o YouTube publica vídeo; imagem só existe como miniatura, que é uma setting e não anexo
      images: { maxCount: 0, mimeTypes: [] },
      videos: { maxCount: 1, mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'] },
    },
    threads: false, // comentário no YouTube não é conceito de publicação aqui
    mentions: false,
    analytics: true,
    twoStepConnect: false,
    customInstance: false,
    requiresMedia: true, // sem vídeo não há publicação
  },
  rateDefaults: {
    // a cota é o limite real (~6 uploads/dia por projeto): paralelizar só queima cota em retentativa
    maxConcurrent: 1,
    perChannelWindow: { limit: 6, windowSec: 3600 },
  },
  settingsSchema,
  requiredSecrets: ['clientId', 'clientSecret'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const scopes = ctx.secrets.enableAnalytics ? [...SCOPES, ANALYTICS_SCOPE] : SCOPES;
    const q = new URLSearchParams({
      client_id: ctx.secrets.clientId ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '), // o Google separa escopos por espaço
      state,
      // sem os dois, o Google só devolve refresh token no PRIMEIRO consentimento da conta e o
      // canal morre silenciosamente na primeira expiração
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });
    return { url: `${AUTHORIZE_URL}?${q}`, state };
  },

  async exchangeCode(ctx, { code, redirectUri }) {
    const set = await oauthToken(ctx, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    if (!set.refreshToken) {
      throw {
        status: 400,
        body: 'o Google não devolveu refresh token — refaça a conexão (se o problema persistir, remova o acesso do manypost em myaccount.google.com/permissions e conecte de novo)',
      };
    }
    if (set.scopes.length && !set.scopes.includes(SCOPES[0]!)) {
      throw {
        status: 403,
        body: 'permissão de envio de vídeo não concedida (youtube.upload) — refaça a conexão marcando todas as permissões',
      };
    }

    const channel = await fetchOwnChannel(ctx, set.accessToken);
    const avatar = channel.snippet?.thumbnails?.medium?.url ?? channel.snippet?.thumbnails?.default?.url;
    return {
      ...set,
      // o id do CANAL (não o da conta Google): conectar dois canais da mesma conta vira dois canais
      externalId: channel.id,
      name: channel.snippet?.title ?? 'YouTube',
      ...(channel.snippet?.customUrl ? { username: channel.snippet.customUrl } : {}),
      ...(avatar ? { avatarUrl: avatar } : {}),
    };
  },

  async refreshToken(ctx, refreshToken) {
    const set = await oauthToken(ctx, { grant_type: 'refresh_token', refresh_token: refreshToken });
    // o Google não reemite o refresh token na renovação — preservamos o que já está guardado
    return { ...set, refreshToken: set.refreshToken ?? refreshToken };
  },

  async publish(ctx, token, items, rawSettings) {
    const item = items[0];
    const video = item?.media.find((m) => m.type === 'video');
    if (!item || !video) throw { status: 422, body: 'o YouTube exige um vídeo' };
    const cfg = settingsSchema.parse(rawSettings ?? {});

    const geometry = await probeGeometry(ctx, video.url);
    const verdict = enforceShortsIntent(cfg.shortsIntent, geometry);
    if (!verdict.ok) throw { status: 422, body: verdict.reason };
    ctx.log('info', 'youtube: formato do vídeo medido', {
      willBeShort: verdict.willBeShort ?? null,
      ...(geometry ? { width: geometry.width, height: geometry.height, durationSec: Math.round(geometry.durationSec) } : {}),
    });

    const uploaded = await uploadVideo(
      ctx,
      token.accessToken,
      buildVideoMetadata(cfg, item, ctx.now()),
      { url: video.url, mime: video.mime ?? 'video/mp4' },
    );

    // DAQUI PARA BAIXO NADA PODE LANÇAR: o vídeo já está no canal e um throw faria a máquina de
    // estados retentar a publicação inteira — ou seja, subir o vídeo de novo.
    if (cfg.thumbnailUrl) {
      try {
        const img = await ctx.fetch(cfg.thumbnailUrl, { signal: AbortSignal.timeout(60_000) });
        if (img.ok) {
          const res = await ctx.fetch(`${UPLOAD_BASE}/thumbnails/set?videoId=${uploaded.id}`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token.accessToken}`,
              'content-type': img.headers.get('content-type') ?? 'image/jpeg',
            },
            body: new Uint8Array(await img.arrayBuffer()),
          });
          if (!res.ok) {
            ctx.log('warn', 'youtube: miniatura recusada — o vídeo foi publicado sem ela', {
              status: res.status,
            });
          }
        }
      } catch (err) {
        ctx.log('warn', 'youtube: falha ao enviar a miniatura — o vídeo foi publicado sem ela', {
          error: String(err),
        });
      }
    }

    // projeto sem auditoria de conformidade: o YouTube força privado mesmo pedindo público.
    // Isso é sucesso, não falha — retentar só duplicaria o vídeo.
    if (cfg.privacyStatus !== 'private' && uploaded.status?.privacyStatus === 'private') {
      ctx.log('warn', 'youtube: vídeo publicado como privado pelo YouTube — o projeto no Google ainda não passou pela auditoria de conformidade', {
        requested: cfg.privacyStatus,
      });
    }

    return [{ externalId: uploaded.id!, releaseUrl: `https://www.youtube.com/watch?v=${uploaded.id}` }];
  },

  async validateMedia(items) {
    const first = items[0];
    const videos = first?.media.filter((m) => m.type === 'video') ?? [];
    if (videos.length === 0) {
      return { ok: false, reason: 'o YouTube exige um vídeo — não existe publicação só de texto' };
    }
    if ((first?.media.length ?? 0) > videos.length) {
      return {
        ok: false,
        reason: 'o YouTube aceita só o vídeo; a imagem de capa é a miniatura, configurada nas opções do canal',
      };
    }
    return checkMediaRules(items, youtubeProvider.capabilities.media);
  },

  classifyError(status, body) {
    // reconectar: consentimento revogado, token inválido ou escopo insuficiente
    if (
      status === 401 ||
      /invalid_grant|UNAUTHENTICATED|authError|Invalid Credentials|insufficientPermissions|youtubeSignupRequired/i.test(
        body,
      )
    ) {
      return 'refresh-token';
    }
    // cota do dia estourada: retentar hoje não muda nada
    if (/quotaExceeded|dailyLimitExceeded|uploadLimitExceeded/i.test(body)) return 'permanent';
    // retentável: limite de taxa curto e instabilidade do Google
    if (status === 429 || status >= 500 || /rateLimitExceeded|backendError|internalError/i.test(body)) {
      return 'transient';
    }
    // o resto (invalidTitle, invalidDescription, invalidTags, invalidCategoryId, mediaBodyRequired…)
    // reenviaria o mesmo corpo e falharia igual
    return 'permanent';
  },

  async fetchAnalytics(ctx, token, range) {
    if (!token.scopes.includes(ANALYTICS_SCOPE)) {
      throw {
        status: 403,
        body: 'métricas do YouTube exigem reconectar o canal com as métricas habilitadas na instalação (YOUTUBE_ENABLE_ANALYTICS)',
      };
    }
    const q = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: range.from.slice(0, 10),
      endDate: range.to.slice(0, 10),
      metrics: 'views,estimatedMinutesWatched,likes,subscribersGained',
      dimensions: 'day',
      sort: 'day',
    });
    const data = await google<{ columnHeaders?: Array<{ name?: string }>; rows?: unknown[][] }>(
      ctx,
      `${ANALYTICS_BASE}/reports?${q}`,
      { headers: { authorization: `Bearer ${token.accessToken}` } },
    );
    const columns = data.columnHeaders?.map((c) => c.name ?? '') ?? [];
    const dayAt = columns.indexOf('day');
    return columns
      .map((metric, index) => ({ metric, index }))
      .filter(({ metric, index }) => metric && index !== dayAt)
      .map(({ metric, index }) => ({
        metric,
        points: (data.rows ?? []).map((row) => ({
          date: String(row[dayAt] ?? ''),
          value: Number(row[index] ?? 0),
        })),
      }));
  },

  async fetchPostAnalytics(ctx, token, externalId) {
    const data = await google<{
      items?: Array<{ statistics?: Record<string, string> }>;
    }>(ctx, `${API_BASE}/videos?part=statistics&id=${encodeURIComponent(externalId)}`, {
      headers: { authorization: `Bearer ${token.accessToken}` },
    });
    const stats = data.items?.[0]?.statistics;
    if (!stats) return [];
    const date = ctx.now().toISOString().slice(0, 10);
    return (['viewCount', 'likeCount', 'commentCount'] as const)
      .filter((k) => stats[k] !== undefined)
      .map((k) => ({ metric: k, points: [{ date, value: Number(stats[k]) }] }));
  },
};
