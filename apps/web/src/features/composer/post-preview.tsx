'use client';

import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { useMediaList } from '@/features/media/hooks';
import { MediaThumb } from '@/features/media/media-thumb';
import type { components } from '@/lib/api/schema';
import { cn } from '@/lib/utils';

type Channel = components['schemas']['Channel'];

interface PreviewItem {
  text: string;
  mediaIds: string[];
}

/** Um post (item 0 ou réplica) dentro do preview — avatar + texto + mídia. */
function PreviewEntry({
  channel,
  text,
  mediaIds,
  connected,
}: {
  channel: Channel;
  text: string;
  mediaIds: string[];
  connected: boolean;
}) {
  const media = useMediaList();
  const byId = new Map((media.data ?? []).map((m) => [m.id, m]));
  const name = channel.name ?? channel.username ?? channel.id;

  return (
    <div className="relative flex gap-2.5">
      {connected ? (
        // conector vertical da thread (como o preview do Postiz)
        <span aria-hidden className="absolute -top-3 bottom-full left-4 w-px bg-line" />
      ) : null}
      <span className="relative z-10 shrink-0">
        <Avatar className="size-8">
          {channel.avatarUrl ? <AvatarImage src={channel.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[11px]">{name.charAt(0)}</AvatarFallback>
        </Avatar>
        {PROVIDER_ICONS[channel.provider] ? (
          <img
            src={PROVIDER_ICONS[channel.provider]}
            alt=""
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-sm border border-surface"
          />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[13px] font-semibold text-ink">{name}</span>
          {channel.username ? (
            <span className="text-xs text-graphite">@{channel.username.replace(/^@/, '')}</span>
          ) : null}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
          {text}
        </p>
        {mediaIds.length > 0 ? (
          <ul className={cn('mt-2 grid gap-1.5', mediaIds.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
            {mediaIds.map((id) => {
              const item = byId.get(id);
              return item ? (
                <li key={id}>
                  <MediaThumb
                    url={item.url}
                    mime={item.mime}
                    alt={item.alt}
                    className={cn(
                      'w-full rounded-md border border-line',
                      mediaIds.length === 1 ? 'max-h-52' : 'aspect-square',
                    )}
                  />
                </li>
              ) : null;
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Preview ao vivo do composer (direção do Postiz "Post Preview"): um cartão
 * por canal selecionado, com o texto efetivo (override quando houver) e a
 * thread encadeada por um conector vertical.
 */
export function PostPreview({
  channels,
  textFor,
  mediaIds,
  thread,
}: {
  channels: Channel[];
  textFor: (channelId: string) => string;
  mediaIds: string[];
  thread: PreviewItem[];
}) {
  const t = useTranslations('composer.preview');

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
        <article key={ch.id} className="rounded-lg border border-line bg-surface p-3">
          <div className="flex flex-col gap-3">
            <PreviewEntry channel={ch} text={textFor(ch.id)} mediaIds={mediaIds} connected={false} />
            {thread.map((item, i) => (
              <PreviewEntry
                key={i}
                channel={ch}
                text={item.text}
                mediaIds={item.mediaIds}
                connected
              />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
