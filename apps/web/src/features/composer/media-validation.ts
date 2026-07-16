import type { components } from '@/lib/api/schema';

type ProviderInfo = components['schemas']['ChannelProviderInfo'];
type Media = components['schemas']['Media'];

export type MediaIssue =
  | { code: 'tooManyImages'; max: number }
  | { code: 'tooManyVideos'; max: number }
  | { code: 'mixedMedia' }
  | { code: 'unsupportedType'; mime: string }
  | { code: 'tooLarge'; mime: string };

/**
 * Espelho client-side do `checkMediaRules` compartilhado dos providers
 * (contagem por tipo, mistura imagem/vídeo, MIME, teto de bytes) — feedback
 * imediato; o servidor revalida no agendamento (SPEC_FRONTEND §3.3).
 */
export function validateMediaForProvider(provider: ProviderInfo, media: Media[]): MediaIssue[] {
  const issues: MediaIssue[] = [];
  const images = media.filter((m) => m.mime.startsWith('image/'));
  const videos = media.filter((m) => m.mime.startsWith('video/'));

  if (images.length > 0 && videos.length > 0) issues.push({ code: 'mixedMedia' });
  if (images.length > provider.media.images.maxCount)
    issues.push({ code: 'tooManyImages', max: provider.media.images.maxCount });
  if (videos.length > provider.media.videos.maxCount)
    issues.push({ code: 'tooManyVideos', max: provider.media.videos.maxCount });

  for (const m of media) {
    const rule = m.mime.startsWith('video/') ? provider.media.videos : provider.media.images;
    if (rule.maxCount === 0) continue; // já coberto pelos limites acima
    if (!rule.mimeTypes.includes(m.mime)) issues.push({ code: 'unsupportedType', mime: m.mime });
    if (rule.maxBytes !== undefined && m.byteSize > rule.maxBytes)
      issues.push({ code: 'tooLarge', mime: m.mime });
  }
  return issues;
}
