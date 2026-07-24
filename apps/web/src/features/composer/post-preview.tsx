'use client';

import { useTranslations } from 'next-intl';
import { useMediaList } from '@/features/media/hooks';
import type { components } from '@/lib/api/schema';
import { NetworkPreview, type PreviewMediaRef } from './network-preview';

type Channel = components['schemas']['Channel'];

interface PreviewItem {
  text: string;
  mediaIds: string[];
}

/**
 * Preview ao vivo do composer: um cartão por canal selecionado com o layout
 * aproximado da rede de destino
 * (network-preview.tsx), texto efetivo (override quando houver) e thread.
 */
export function PostPreview({
  channels,
  textFor,
  settingsFor,
  mediaIds,
  thread,
  publishAt,
}: {
  channels: Channel[];
  textFor: (channelId: string) => string;
  /** settings em edição do canal — o preview do Dev.to tira o título do artigo daqui */
  settingsFor?: (channelId: string) => Record<string, unknown>;
  mediaIds: string[];
  thread: PreviewItem[];
  publishAt?: Date | null;
}) {
  const t = useTranslations('composer.preview');
  const media = useMediaList();
  const byId = new Map((media.data ?? []).map((m) => [m.id, m]));
  const resolve = (ids: string[]): PreviewMediaRef[] =>
    ids
      .map((id) => byId.get(id))
      .filter((m) => m !== undefined)
      .map((m) => ({ url: m.url, mime: m.mime, alt: m.alt }));

  if (channels.length === 0) {
    return <p className="text-sm leading-relaxed text-graphite">{t('noChannels')}</p>;
  }

  const anyText = channels.some((ch) => textFor(ch.id).trim().length > 0);
  if (!anyText && mediaIds.length === 0) {
    return <p className="text-sm leading-relaxed text-graphite">{t('startWriting')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {channels.map((ch) => (
        <NetworkPreview
          key={ch.id}
          provider={ch.provider}
          name={ch.name ?? ch.username ?? ch.id}
          username={ch.username}
          avatarUrl={ch.avatarUrl}
          publishAt={publishAt}
          settings={settingsFor?.(ch.id)}
          entries={[
            { text: textFor(ch.id), media: resolve(mediaIds) },
            ...thread.map((item) => ({ text: item.text, media: resolve(item.mediaIds) })),
          ]}
        />
      ))}
    </div>
  );
}
