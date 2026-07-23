'use client';

import { Check, PenSquare, Plug } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChannels } from '@/features/channels/hooks';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { cn } from '@/lib/utils';

/**
 * Painel "Canais" do calendário (direção do Postiz: canais à esquerda da
 * grade). Clicar num canal liga/desliga o filtro do calendário.
 */
export function ChannelsPanel({
  selectedIds,
  onToggle,
  onClear,
}: {
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations('calendar.panel');
  const tConn = useTranslations('connections');
  const channels = useChannels();
  const openComposer = useComposerModal((s) => s.openComposer);

  return (
    <>
      {/* --- MOBILE ONLY (< lg): Barra ergonômica com respiro visual + Seletor de canais --- */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1 gap-2 font-semibold py-5" onClick={() => openComposer()}>
            <PenSquare className="size-4" aria-hidden />
            {t('createPost')}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" size="sm" className="size-10 shrink-0" aria-label={t('addChannel')}>
                <Link href="/conexoes">
                  <Plug className="size-4" aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('addChannel')}</TooltipContent>
          </Tooltip>
        </div>

        {channels.isPending ? (
          <div className="flex flex-col gap-2 mt-1">
            <Skeleton className="h-4 w-20 rounded" />
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
              <Skeleton className="h-10 w-36 shrink-0 rounded-md" />
              <Skeleton className="h-10 w-36 shrink-0 rounded-md" />
            </div>
          </div>
        ) : (channels.data ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-surface-2 px-3 py-3 text-center text-xs leading-relaxed text-graphite mt-1">
            {t('empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2 mt-0.5 border-t border-line pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-graphite">{t('title')}</span>
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-xs font-semibold text-accent hover:underline transition-colors"
                >
                  {t('clearFilter')} ({selectedIds.length})
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 -mx-1 px-1">
              {channels.data!.map((ch) => {
                const selected = selectedIds.includes(ch.id);
                const needsAttention = ch.status !== 'ACTIVE';
                return (
                  <button
                    key={ch.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onToggle(ch.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-2.5 rounded-md border px-3.5 py-2 text-left outline-none transition-all duration-200 min-h-[42px]',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent active:scale-[0.98]',
                      selected
                        ? 'bevel-accent font-bold text-accent'
                        : 'bevel-surface hover:bg-surface-2 text-ink',
                    )}
                  >
                    <span className="relative shrink-0">
                      <Avatar className="size-6">
                        {ch.avatarUrl ? <AvatarImage src={ch.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="text-[11px] font-semibold">
                          {(ch.name ?? ch.username ?? '?').charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {PROVIDER_ICONS[ch.provider] ? (
                        <img
                          src={PROVIDER_ICONS[ch.provider]}
                          alt=""
                          aria-hidden
                          className="absolute -bottom-0.5 -right-0.5 size-3 rounded-sm border border-surface"
                        />
                      ) : null}
                    </span>
                    <span className="max-w-36 truncate text-xs sm:text-sm">{ch.name ?? ch.username ?? ch.id}</span>
                    {needsAttention ? (
                      <span className="size-2 rounded-full bg-state-review shrink-0" title={tConn(`status.${ch.status}`)} />
                    ) : null}
                    {selected ? <Check className="size-4 shrink-0 text-accent" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* --- DESKTOP ONLY (lg+): Sidebar fixa original --- */}
      <aside className="hidden h-fit max-h-[calc(100dvh-7rem)] w-full shrink-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-20 lg:flex lg:w-64">
        <h2 className="text-base font-semibold tracking-[-0.2px] text-ink">{t('title')}</h2>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-1.5" onClick={() => openComposer()}>
            <PenSquare aria-hidden />
            {t('createPost')}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" size="icon-sm" aria-label={t('addChannel')}>
                <Link href="/conexoes">
                  <Plug aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('addChannel')}</TooltipContent>
          </Tooltip>
        </div>

        {channels.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        ) : (channels.data ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-line bg-surface-2 px-3 py-4 text-center text-xs leading-relaxed text-graphite">
            {t('empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 overflow-y-auto" aria-label={t('filterHint')}>
            {channels.data!.map((ch) => {
              const selected = selectedIds.includes(ch.id);
              const needsAttention = ch.status !== 'ACTIVE';
              return (
                <li key={ch.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onToggle(ch.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left outline-none transition-colors duration-200',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      selected
                        ? 'bevel-accent'
                        : 'border-transparent hover:bg-surface-2',
                    )}
                  >
                    <span className="relative shrink-0">
                      <Avatar className="size-7">
                        {ch.avatarUrl ? <AvatarImage src={ch.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="text-[11px]">
                          {(ch.name ?? ch.username ?? '?').charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {PROVIDER_ICONS[ch.provider] ? (
                        <img
                          src={PROVIDER_ICONS[ch.provider]}
                          alt=""
                          aria-hidden
                          className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-sm border border-surface"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {ch.name ?? ch.username ?? ch.id}
                      </span>
                      {needsAttention ? (
                        <span className="block truncate text-[11px] text-state-review">
                          {tConn.has(`status.${ch.status}`) ? tConn(`status.${ch.status}`) : ch.status}
                        </span>
                      ) : null}
                    </span>
                    {selected ? <Check className="size-4 shrink-0 text-accent" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selectedIds.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {t('clearFilter')}
          </Button>
        ) : (
          <p className="text-[11px] leading-relaxed text-mist">{t('filterHint')}</p>
        )}
      </aside>
    </>
  );
}
