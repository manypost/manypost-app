import type { MediaRule, PublishItem } from '@manypost/contracts';

export type MediaVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Validação declarativa de mídia contra as capabilities do provider (SPEC_INTEGRATIONS §2/§7).
 * Regra comum das redes da onda 1 (Mastodon, X, Bluesky): N imagens OU 1 vídeo, sem misturar —
 * providers que aceitam mistura passam allowMixed: true.
 */
export function checkMediaRules(
  items: PublishItem[],
  rules: { images: MediaRule; videos: MediaRule },
  opts: { allowMixed?: boolean } = {},
): MediaVerdict {
  for (const item of items) {
    const images = item.media.filter((m) => m.type === 'image');
    const videos = item.media.filter((m) => m.type === 'video');
    if (!opts.allowMixed && images.length > 0 && videos.length > 0) {
      return { ok: false, reason: 'não é possível misturar imagens e vídeo no mesmo post' };
    }
    if (images.length > rules.images.maxCount) {
      return { ok: false, reason: `máximo de ${rules.images.maxCount} imagem(ns) por post` };
    }
    if (videos.length > rules.videos.maxCount) {
      return { ok: false, reason: `máximo de ${rules.videos.maxCount} vídeo(s) por post` };
    }
    for (const m of item.media) {
      const rule = m.type === 'image' ? rules.images : rules.videos;
      if (m.mime && rule.mimeTypes.length > 0 && !rule.mimeTypes.includes(m.mime)) {
        return { ok: false, reason: `formato ${m.mime} não é aceito nesta rede` };
      }
    }
  }
  return { ok: true };
}
