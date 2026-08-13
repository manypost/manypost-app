import type {
  MediaRef,
  MediaRule,
  ProviderContext,
  PublishItem,
  PublishResult,
} from '@manypost/contracts';
import { checkMediaRules, type MediaVerdict } from './media-rules';
import { metaFetch } from './meta-graph';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/instagram.provider.ts
// e instagram.standalone.provider.ts — o fluxo container `/media` → poll `status_code` →
// `/media_publish`, o carrossel por filhos `is_carousel_item`, o comentário de thread e a taxonomia
// de erros da Meta são OS MESMOS nas duas variantes (no Postiz o standalone delega ao provider base
// trocando o host). Aqui o pipeline tem fonte única; o que muda por variante é o host da Graph, o
// OAuth e como o alvo de publicação (id + token) é resolvido:
//  - `instagram` (Facebook Business): Página escolhida por post → token da Página + conta IG;
//  - `instagram-standalone` (Instagram Login): a própria conta conectada.

export const INSTAGRAM_MAX_LEN = 2200;
/** carrossel do Instagram: 2 a 10 itens, imagens e vídeos podem se misturar */
export const INSTAGRAM_CAROUSEL_MAX = 10;
/** os tokens longos da Meta duram ~60 dias (a resposta traz expires_in; isto é o piso do fallback) */
export const META_LONG_LIVED_FALLBACK_SEC = 60 * 24 * 3600;

// A Meta processa mídia em segundo plano: o container só pode ser publicado em FINISHED. O
// orçamento de polls é COMPARTILHADO por publicação (pai + filhos do carrossel) para o total
// ficar abaixo do watchdog de zumbis (15 min) mesmo num carrossel de 10 vídeos.
const POLL_INTERVAL_MS = 3_000;
export const INSTAGRAM_POLL_BUDGET = 140; // ~7 min somados

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** corpo form-urlencoded sem chaves vazias (mídia sem legenda não manda `caption`). */
export const igForm = (params: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as Array<[string, string]>,
  );

export const igProfileUrl = (username: string | undefined): string | undefined =>
  username ? `https://www.instagram.com/${username.replace(/^@/, '')}` : undefined;

export interface IgMediaOpts {
  story: boolean;
  carouselItem: boolean;
}

/**
 * Parâmetros do container de uma mídia: a Meta faz *pull* da mídia pela URL pública (não subimos
 * bytes). No feed, vídeo único vira REELS; dentro de carrossel vira VIDEO; story vira STORIES.
 * Imagem no feed dispensa media_type (IMAGE é o default). Sem alt_text: a Content Publishing API
 * não aceita texto alternativo na criação do container.
 */
export function igMediaParams(m: MediaRef, opts: IgMediaOpts): Record<string, string | undefined> {
  const carousel = opts.carouselItem ? { is_carousel_item: 'true' } : {};
  if (m.type === 'video') {
    const media_type = opts.story ? 'STORIES' : opts.carouselItem ? 'VIDEO' : 'REELS';
    return { ...carousel, video_url: m.url, media_type };
  }
  return { ...carousel, image_url: m.url, ...(opts.story ? { media_type: 'STORIES' } : {}) };
}

/** Quem publica: o id que endereça `/{id}/media` e o token que assina — mais o username p/ fallback. */
export interface IgPublishTarget {
  publisherId: string;
  accessToken: string;
  username?: string | undefined;
}

/**
 * Pipeline de publicação da Graph do Instagram, amarrado à base da variante
 * (`graph.facebook.com/vXX` no Facebook Business; `graph.instagram.com/vXX` no Instagram Login).
 */
export const makeInstagramGraph = (apiBase: string) => {
  const apiPost = <T>(
    ctx: ProviderContext,
    path: string,
    params: Record<string, string | undefined>,
  ): Promise<T> =>
    metaFetch<T>(ctx, `${apiBase}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: igForm(params),
    });

  /** Poll do container até FINISHED. ERROR/EXPIRED = permanente; estourar o orçamento = transient
   *  (nada foi publicado ainda, então retentar é seguro e nunca duplica). */
  const waitContainer = async (
    ctx: ProviderContext,
    accessToken: string,
    containerId: string,
    budget: { left: number },
  ): Promise<void> => {
    while (budget.left > 0) {
      budget.left -= 1;
      const q = new URLSearchParams({ fields: 'status_code,status', access_token: accessToken });
      const { status_code, status } = await metaFetch<{ status_code?: string; status?: string }>(
        ctx,
        `${apiBase}/${containerId}?${q}`,
      );
      const s = status_code ?? status;
      if (!s || s === 'FINISHED' || s === 'PUBLISHED') return;
      if (s === 'ERROR' || s === 'EXPIRED') {
        throw { status: 422, body: status ?? `o Instagram recusou a mídia (${s})` };
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw { status: 504, body: 'o Instagram demorou demais para processar a mídia' };
  };

  const createContainer = async (
    ctx: ProviderContext,
    target: IgPublishTarget,
    params: Record<string, string | undefined>,
  ): Promise<string> => {
    const { id } = await apiPost<{ id: string }>(ctx, `/${target.publisherId}/media`, {
      ...params,
      access_token: target.accessToken,
    });
    return id;
  };

  const permalinkOf = async (
    ctx: ProviderContext,
    mediaId: string,
    accessToken: string,
  ): Promise<string | undefined> => {
    try {
      const q = new URLSearchParams({ fields: 'permalink', access_token: accessToken });
      return (await metaFetch<{ permalink?: string }>(ctx, `${apiBase}/${mediaId}?${q}`)).permalink;
    } catch {
      return undefined;
    }
  };

  /** Espera o container, publica e resolve o permalink (best-effort — o post já está na rede). */
  const publishCreation = async (
    ctx: ProviderContext,
    target: IgPublishTarget,
    creationId: string,
    budget: { left: number },
  ): Promise<PublishResult> => {
    await waitContainer(ctx, target.accessToken, creationId, budget);
    const { id: mediaId } = await apiPost<{ id: string }>(
      ctx,
      `/${target.publisherId}/media_publish`,
      { creation_id: creationId, access_token: target.accessToken },
    );

    // DAQUI PARA BAIXO o post JÁ ESTÁ na rede: lançar faria a máquina de estados retentar e
    // repostar. O permalink é enfeite — falhou, cai no perfil (ou fica sem URL).
    const releaseUrl =
      (await permalinkOf(ctx, mediaId, target.accessToken)) ?? igProfileUrl(target.username);
    return { externalId: mediaId, ...(releaseUrl ? { releaseUrl } : {}) };
  };

  /** story de mídia ÚNICA (não existe carrossel de story — o chamador barra >1 antes). */
  const publishStory = async (
    ctx: ProviderContext,
    target: IgPublishTarget,
    media: MediaRef,
    budget: { left: number },
  ): Promise<PublishResult> => {
    const creationId = await createContainer(
      ctx,
      target,
      igMediaParams(media, { story: true, carouselItem: false }),
    );
    return publishCreation(ctx, target, creationId, budget);
  };

  const publishSingle = async (
    ctx: ProviderContext,
    target: IgPublishTarget,
    media: MediaRef,
    caption: string,
    budget: { left: number },
  ): Promise<PublishResult> => {
    const creationId = await createContainer(ctx, target, {
      ...igMediaParams(media, { story: false, carouselItem: false }),
      caption,
    });
    return publishCreation(ctx, target, creationId, budget);
  };

  /** carrossel 2–10: filhos SEM legenda (só o pai carrega a caption). */
  const publishCarousel = async (
    ctx: ProviderContext,
    target: IgPublishTarget,
    media: MediaRef[],
    caption: string,
    budget: { left: number },
  ): Promise<PublishResult> => {
    const children: string[] = [];
    for (const m of media) {
      children.push(
        await createContainer(ctx, target, igMediaParams(m, { story: false, carouselItem: true })),
      );
    }
    // os filhos precisam estar processados ANTES de virar carrossel
    for (const id of children) await waitContainer(ctx, target.accessToken, id, budget);

    const parent = await createContainer(ctx, target, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption,
    });
    return publishCreation(ctx, target, parent, budget);
  };

  /** réplica de thread = COMENTÁRIO no post raiz (só texto) — paridade com o comment() do Postiz. */
  const comment = async (
    ctx: ProviderContext,
    target: IgPublishTarget,
    parentExternalId: string,
    message: string,
  ): Promise<PublishResult> => {
    const { id: commentId } = await apiPost<{ id: string }>(ctx, `/${parentExternalId}/comments`, {
      message,
      access_token: target.accessToken,
    });
    // o comentário não tem URL própria: cai no permalink do post pai (ou no perfil)
    const releaseUrl =
      (await permalinkOf(ctx, parentExternalId, target.accessToken)) ??
      igProfileUrl(target.username);
    return { externalId: commentId, ...(releaseUrl ? { releaseUrl } : {}) };
  };

  return {
    apiPost,
    waitContainer,
    createContainer,
    permalinkOf,
    publishCreation,
    publishStory,
    publishSingle,
    publishCarousel,
    comment,
  };
};

/**
 * Regras de mídia do Instagram — as mesmas nas duas variantes: post exige mídia, carrossel tem
 * teto, imagem e vídeo podem se misturar (allowMixed) e réplica de thread (comentário) é só texto.
 */
export function validateInstagramMedia(
  items: PublishItem[],
  mediaCapabilities: { images: MediaRule; videos: MediaRule },
): MediaVerdict {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (i === 0) {
      if (item.media.length === 0) {
        return { ok: false, reason: 'o Instagram exige ao menos uma imagem ou vídeo' };
      }
      if (item.media.length > INSTAGRAM_CAROUSEL_MAX) {
        return {
          ok: false,
          reason: `máximo de ${INSTAGRAM_CAROUSEL_MAX} itens no carrossel do Instagram`,
        };
      }
      // carrossel do Instagram aceita imagem e vídeo no mesmo post (allowMixed)
      const verdict = checkMediaRules([item], mediaCapabilities, { allowMixed: true });
      if (!verdict.ok) return verdict;
    } else if (item.media.length > 0) {
      // réplicas são comentários — o endpoint de comentário só aceita texto
      return { ok: false, reason: 'comentários no Instagram são somente texto' };
    }
  }
  return { ok: true };
}

/**
 * Classificação de erros da Meta — a mesma taxonomia nas duas variantes. `alsoRefresh` acrescenta
 * padrões de refresh específicos da variante (ex.: `Page publishing authorization` no Facebook
 * Business).
 */
export function classifyInstagramError(
  status: number,
  body: string,
  opts?: { alsoRefresh?: RegExp },
): 'refresh-token' | 'transient' | 'permanent' {
  // token expirado/revogado ou conta que deixou de ser business: refresh e, se não der, reconexão
  if (
    status === 401 ||
    /REVOKED_ACCESS_TOKEN|"error_subcode":\s*33|not an instagram business|session has been invalidated|Error validating access token|OAuthException|"code":\s*190\b/i.test(
      body,
    ) ||
    (opts?.alsoRefresh ? opts.alsoRefresh.test(body) : false)
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
}
