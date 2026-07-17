'use client';

import {
  Bookmark,
  ChartNoAxesColumn,
  Eye,
  Globe,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Share,
  Star,
  ThumbsUp,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { MediaThumb } from '@/features/media/media-thumb';
import { cn } from '@/lib/utils';

/**
 * Preview por rede (SPEC_FRONTEND §3.3 — "aproximação visual do post em cada
 * plataforma, como o Postiz"): cada provider ganha um layout que lembra a rede
 * de destino, na versão minimalista do brand (tokens, zero sombras). Usado no
 * composer E na página pública de aprovação (§3.6 — mesmos componentes).
 * Todo o chrome da rede (ícones de ação, contadores) é decorativo: aria-hidden.
 */

/** Mídia já resolvida (o composer resolve mediaId→URL; a aprovação recebe URLs). */
export interface PreviewMediaRef {
  url: string;
  mime: string;
  alt?: string | null;
}

/** Um item do post: índice 0 = principal, 1+ = réplicas da thread. */
export interface PreviewEntryData {
  text: string;
  media: PreviewMediaRef[];
}

interface NetworkProps {
  provider: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  entries: PreviewEntryData[];
  timeLabel: string;
}

type Icon = ComponentType<{ className?: string }>;

function ChannelAvatar({
  name,
  avatarUrl,
  provider,
  className,
  badge = true,
}: {
  name: string;
  avatarUrl: string | null;
  provider: string;
  className?: string;
  badge?: boolean;
}) {
  return (
    // self-start: numa linha flex o span esticaria (stretch) e o badge
    // absoluto desceria p/ o pé do cartão em vez do canto do avatar
    <span className="relative z-10 shrink-0 self-start">
      <Avatar className={className}>
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-[11px]">{name.charAt(0)}</AvatarFallback>
      </Avatar>
      {badge && PROVIDER_ICONS[provider] ? (
        <img
          src={PROVIDER_ICONS[provider]}
          alt=""
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-sm border border-surface"
        />
      ) : null}
    </span>
  );
}

function MediaGrid({
  media,
  className,
  singleClassName = 'max-h-52',
}: {
  media: PreviewMediaRef[];
  className?: string;
  singleClassName?: string;
}) {
  if (media.length === 0) return null;
  return (
    <ul className={cn('grid gap-1', media.length === 1 ? 'grid-cols-1' : 'grid-cols-2', className)}>
      {media.map((m, i) => (
        <li key={i}>
          <MediaThumb
            url={m.url}
            mime={m.mime}
            alt={m.alt}
            className={cn(
              'w-full rounded-md border border-line',
              media.length === 1 ? singleClassName : 'aspect-square',
            )}
          />
        </li>
      ))}
    </ul>
  );
}

/** Linha de ações da rede — puramente decorativa. */
function ActionRow({ icons, className }: { icons: Icon[]; className?: string }) {
  return (
    <div aria-hidden className={cn('flex max-w-56 items-center justify-between text-mist', className)}>
      {icons.map((ActionIcon, i) => (
        <ActionIcon key={i} className="size-3.5" />
      ))}
    </div>
  );
}

/**
 * Base dos microblogs (X/Bluesky/Mastodon): avatar + nome/handle/hora,
 * texto, mídia em grade e thread encadeada por conector vertical.
 */
function MicroblogPreview({ p, actions }: { p: NetworkProps; actions?: Icon[] }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-col gap-3">
        {p.entries.map((entry, i) => (
          <div key={i} className="relative flex gap-2.5">
            {i > 0 ? (
              <span aria-hidden className="absolute -top-3 bottom-full left-[17px] w-px bg-line" />
            ) : null}
            <ChannelAvatar name={p.name} avatarUrl={p.avatarUrl} provider={p.provider} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                {p.username ? (
                  <span className="text-xs text-graphite">@{p.username.replace(/^@/, '')}</span>
                ) : null}
                <span className="text-xs text-mist">· {p.timeLabel}</span>
              </p>
              {entry.text ? (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                  {entry.text}
                </p>
              ) : null}
              <MediaGrid media={entry.media} className="mt-2" />
              {actions ? <ActionRow icons={actions} className="mt-2" /> : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function XPreview({ p }: { p: NetworkProps }) {
  return <MicroblogPreview p={p} actions={[MessageCircle, Repeat2, Heart, ChartNoAxesColumn, Share]} />;
}

function BlueskyPreview({ p }: { p: NetworkProps }) {
  return <MicroblogPreview p={p} actions={[MessageCircle, Repeat2, Heart, Share]} />;
}

function MastodonPreview({ p }: { p: NetworkProps }) {
  return <MicroblogPreview p={p} actions={[MessageCircle, Repeat2, Star, Bookmark, Share]} />;
}

/** Sem layout próprio da rede (ex.: fake) — cartão neutro, sem chrome. */
function GenericPreview({ p }: { p: NetworkProps }) {
  return <MicroblogPreview p={p} />;
}

/** LinkedIn: cabeçalho com hora + globo, mídia de ponta a ponta, barra de ações e réplicas como comentários. */
function LinkedinPreview({ p }: { p: NetworkProps }) {
  const t = useTranslations('composer.preview.linkedin');
  const [main, ...replies] = p.entries;
  if (!main) return null;
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex gap-2.5">
        <ChannelAvatar name={p.name} avatarUrl={p.avatarUrl} provider={p.provider} className="size-10" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-ink">{p.name}</p>
          {p.username ? (
            <p className="text-xs leading-tight text-graphite">@{p.username.replace(/^@/, '')}</p>
          ) : null}
          <p className="mt-0.5 flex items-center gap-1 text-xs leading-tight text-mist">
            {p.timeLabel} · <Globe className="size-3" aria-hidden />
          </p>
        </div>
      </div>
      {main.text ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
          {main.text}
        </p>
      ) : null}
      {main.media.length > 0 ? (
        // mídia de ponta a ponta, como no feed do LinkedIn
        <div className="-mx-4 mt-3 flex gap-px overflow-hidden border-y border-line">
          {main.media.map((m, i) => (
            <MediaThumb
              key={i}
              url={m.url}
              mime={m.mime}
              alt={m.alt}
              className={cn('min-w-0 flex-1', main.media.length === 1 ? 'max-h-64' : 'aspect-square')}
            />
          ))}
        </div>
      ) : null}
      <div
        aria-hidden
        className="mt-3 grid grid-cols-4 gap-1 border-t border-line pt-2.5 text-[11px] font-semibold text-graphite"
      >
        <span className="flex items-center justify-center gap-1">
          <ThumbsUp className="size-3.5" /> {t('like')}
        </span>
        <span className="flex items-center justify-center gap-1">
          <MessageCircle className="size-3.5" /> {t('comment')}
        </span>
        <span className="flex items-center justify-center gap-1">
          <Repeat2 className="size-3.5" /> {t('repost')}
        </span>
        <span className="flex items-center justify-center gap-1">
          <Send className="size-3.5" /> {t('send')}
        </span>
      </div>
      {replies.length > 0 ? (
        // no LinkedIn a thread vira comentários no post raiz (STATUS §3.18)
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {replies.map((reply, i) => (
            <div key={i} className="flex gap-2">
              <ChannelAvatar
                name={p.name}
                avatarUrl={p.avatarUrl}
                provider={p.provider}
                className="size-7"
                badge={false}
              />
              <div className="min-w-0 flex-1 rounded-md bg-surface-2 px-2.5 py-2">
                <p className="text-xs font-semibold text-ink">{p.name}</p>
                {reply.text ? (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink">
                    {reply.text}
                  </p>
                ) : null}
                <MediaGrid media={reply.media} className="mt-1.5" singleClassName="max-h-40" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** Telegram: bolhas de canal sobre o fundo do chat, mídia acima do texto, hora + visualizações no rodapé. */
function TelegramPreview({ p }: { p: NetworkProps }) {
  return (
    <article className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex flex-col gap-2">
        {p.entries.map((entry, i) => (
          <div key={i} className="max-w-[92%] overflow-hidden rounded-lg border border-line bg-surface">
            {entry.media.length > 0 ? (
              <div className={cn('grid gap-px', entry.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                {entry.media.map((m, mi) => (
                  <MediaThumb
                    key={mi}
                    url={m.url}
                    mime={m.mime}
                    alt={m.alt}
                    className={cn('w-full', entry.media.length === 1 ? 'max-h-52' : 'aspect-square')}
                  />
                ))}
              </div>
            ) : null}
            <div className="px-3 py-2">
              {i === 0 ? (
                <p className="text-[13px] font-semibold leading-snug text-accent">{p.name}</p>
              ) : null}
              {entry.text ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                  {entry.text}
                </p>
              ) : null}
              <p aria-hidden className="mt-1 flex items-center justify-end gap-1 text-[11px] text-mist">
                <Eye className="size-3" /> {p.timeLabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

/** Discord: mensagem de webhook — nome + chip APP + hora; itens extras viram continuação sem avatar. */
function DiscordPreview({ p }: { p: NetworkProps }) {
  const [main, ...rest] = p.entries;
  if (!main) return null;
  return (
    <article className="rounded-lg border border-line bg-surface p-3">
      <div className="flex gap-2.5">
        <ChannelAvatar name={p.name} avatarUrl={p.avatarUrl} provider={p.provider} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold text-ink">{p.name}</span>
            <span
              aria-hidden
              className="rounded-sm bg-accent px-1 text-[9px] font-bold leading-4 text-paper"
            >
              APP
            </span>
            <span className="text-xs text-mist">{p.timeLabel}</span>
          </p>
          {[main, ...rest].map((entry, i) => (
            <div key={i} className={i > 0 ? 'mt-2' : undefined}>
              {entry.text ? (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                  {entry.text}
                </p>
              ) : null}
              {entry.media.length > 0 ? (
                <ul className="mt-1.5 flex max-w-64 flex-col gap-1.5">
                  {entry.media.map((m, mi) => (
                    <li key={mi}>
                      <MediaThumb
                        url={m.url}
                        mime={m.mime}
                        alt={m.alt}
                        className="w-full rounded-md border border-line"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

const PREVIEWS: Record<string, ComponentType<{ p: NetworkProps }>> = {
  x: XPreview,
  bluesky: BlueskyPreview,
  mastodon: MastodonPreview,
  linkedin: LinkedinPreview,
  telegram: TelegramPreview,
  discord: DiscordPreview,
  'discord-webhook': DiscordPreview,
};

export function NetworkPreview({
  provider,
  name,
  username,
  avatarUrl,
  entries,
  publishAt,
}: {
  provider: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  entries: PreviewEntryData[];
  /** horário agendado — sem valor, o chrome mostra "agora" */
  publishAt?: Date | null;
}) {
  const locale = useLocale();
  const t = useTranslations('composer.preview');

  let timeLabel = t('now');
  if (publishAt && !Number.isNaN(publishAt.getTime())) {
    const sameDay = publishAt.toDateString() === new Date().toDateString();
    timeLabel = new Intl.DateTimeFormat(
      locale,
      sameDay
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    ).format(publishAt);
  }

  const Preview = PREVIEWS[provider] ?? GenericPreview;
  return (
    <Preview
      p={{
        provider,
        name,
        username: username ?? null,
        avatarUrl: avatarUrl ?? null,
        entries,
        timeLabel,
      }}
    />
  );
}
