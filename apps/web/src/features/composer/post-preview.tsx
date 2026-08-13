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
 * Preview ao vivo do composer: UM cartão por vez, com o layout aproximado da rede
 * de destino (network-preview.tsx). `current` é 'global' (cartão neutro com o texto
 * base) ou o id de um canal (a rede dele). Trocar de rede é papel do seletor
 * globo+canais no composer — antes empilhávamos todos os canais e a tela inflava.
 */
export function PostPreview({
  current,
  channels,
  globalText,
  textFor,
  settingsFor,
  mediaIds,
  thread,
  publishAt,
}: {
  /** 'global' = cartão neutro; senão o id do canal exibido */
  current: string;
  channels: Channel[];
  /** texto base (usado no cartão global) */
  globalText: string;
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
    return <p className="text-compact leading-relaxed text-graphite">{t('noChannels')}</p>;
  }

  const channel = current === 'global' ? undefined : channels.find((ch) => ch.id === current);
  const text = channel ? textFor(channel.id) : globalText;

  if (text.trim().length === 0 && mediaIds.length === 0) {
    return <p className="text-compact leading-relaxed text-graphite">{t('startWriting')}</p>;
  }

  const entries = [
    { text, media: resolve(mediaIds) },
    ...thread.map((item) => ({ text: item.text, media: resolve(item.mediaIds) })),
  ];

  // cartão global: provider desconhecido cai no GenericPreview (cartão neutro, sem chrome de rede)
  if (!channel) {
    return <NetworkPreview provider="__global__" name={t('globalCard')} publishAt={publishAt} entries={entries} />;
  }

  return (
    <NetworkPreview
      provider={channel.provider}
      name={channel.name ?? channel.username ?? channel.id}
      username={channel.username}
      avatarUrl={channel.avatarUrl}
      publishAt={publishAt}
      settings={settingsFor?.(channel.id)}
      entries={entries}
    />
  );
}
