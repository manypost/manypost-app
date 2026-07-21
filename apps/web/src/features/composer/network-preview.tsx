'use client';

import {
  Bookmark,
  ChartNoAxesColumn,
  Eye,
  Globe,
  Heart,
  MessageCircle,
  Music,
  Plus,
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

/**
 * TikTok (paridade real da interface no player 9:16 — SPEC_FRONTEND §3.3):
 * cartão que simula a tela do celular em formato retrato 9:16 no tema escuro.
 * Apresenta o carrossel/vídeo no fundo (ou empty state com ícone musical),
 * rail lateral direita com avatar + badge de follow, curtir, comentar, salvar,
 * compartilhar e disco giratório, além de overlay inferior com @handle, legenda
 * e ticker de som original. Conforme as regras do brand (tokens, zero sombras).
 */
function TiktokPreview({ p }: { p: NetworkProps }) {
  const t = useTranslations('composer.preview.tiktok');
  const main = p.entries[0];
  if (!main) return null;
  const { media } = main;
  const cleanUsername = p.username
    ? p.username.replace(/^@/, '')
    : p.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'usuario';

  return (
    <article className="rounded-lg border border-line bg-surface p-3 max-w-[320px]">
      {/* Cabeçalho do preview com conta e horário */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <ChannelAvatar name={p.name} avatarUrl={p.avatarUrl} provider={p.provider} className="size-6" />
          <span className="truncate text-xs font-semibold text-ink">{p.name}</span>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-mist">{p.timeLabel}</span>
      </div>

      {/* Tela 9:16 estilo celular do TikTok */}
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-line bg-ink text-paper select-none">
        {/* Camada de mídia ou empty state */}
        {media.length > 0 ? (
          <MediaThumb
            url={media[0]!.url}
            mime={media[0]!.mime}
            alt={media[0]!.alt}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4 text-center bg-surface-2/10">
            <div className="flex size-12 items-center justify-center rounded-full border border-paper/10 bg-paper/5 text-paper/80">
              <Music className="size-6 animate-pulse" />
            </div>
            <span className="text-xs font-semibold text-paper/90">{t('media')}</span>
            <span className="text-[11px] text-paper/60 leading-tight">{t('mediaHint')}</span>
          </div>
        )}

        {/* Indicador de carrossel de fotos (quando > 1) */}
        {media.length > 1 ? (
          <span
            aria-hidden
            className="absolute right-2 top-2 z-20 rounded-sm bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-paper border border-paper/10"
          >
            1/{media.length}
          </span>
        ) : null}

        {/* Gradiente escuro para legibilidade perfeita do chrome */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/30 to-transparent pointer-events-none"
        />

        {/* Rail vertical de ações à direita (TikTok Overlay Chrome) */}
        <div aria-hidden className="absolute bottom-6 right-2.5 z-10 flex flex-col items-center gap-3.5 text-paper">
          {/* Avatar de perfil na barra com botão + de follow */}
          <div className="relative mb-1">
            <Avatar className="size-10 border border-paper/30">
              {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-ink text-[11px] text-paper">{p.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex size-4 items-center justify-center rounded-full bg-accent text-paper">
              <Plus className="size-3 stroke-[3]" />
            </span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <Heart className="size-6 stroke-[1.8]" />
            <span className="text-[10px] font-semibold tabular-nums">{t('likes')}</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <MessageCircle className="size-6 stroke-[1.8]" />
            <span className="text-[10px] font-semibold tabular-nums">{t('comments')}</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <Bookmark className="size-6 stroke-[1.8]" />
            <span className="text-[10px] font-semibold tabular-nums">{t('bookmarks')}</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <Share className="size-6 stroke-[1.8]" />
            <span className="text-[10px] font-semibold tabular-nums">{t('shares')}</span>
          </div>

          {/* Disco de música giratório no rodapé direito */}
          <div className="mt-1 flex size-8 items-center justify-center rounded-full border border-paper/30 bg-ink/80 p-1">
            <Music className="size-4 animate-pulse text-paper/90" />
          </div>
        </div>

        {/* Overlay inferior: @handle, legenda e som original */}
        <div className="absolute bottom-5 left-3 right-14 z-10 flex flex-col gap-1.5 text-paper">
          <p className="flex items-center gap-1 text-[13px] font-bold leading-tight">
            <span className="truncate">@{cleanUsername}</span>
          </p>

          {main.text ? (
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-paper/95">
              {main.text}
            </p>
          ) : (
            <p className="italic text-xs text-paper/50">{t('captionPlaceholder')}</p>
          )}

          <div aria-hidden className="mt-0.5 flex w-fit max-w-full items-center gap-1.5 rounded-full border border-paper/10 bg-ink/40 px-2 py-0.5 text-[11px] font-medium text-paper/90">
            <Music className="size-3 shrink-0" />
            <span className="truncate">{t('sound')} - @{cleanUsername}</span>
          </div>
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
  tiktok: TiktokPreview,
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
