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

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-60">
      <h2 className="text-base font-semibold tracking-[-0.2px] text-ink">{t('title')}</h2>
      <div className="flex gap-2">
        <Button asChild size="sm" className="flex-1 gap-1.5">
          <Link href="/compor">
            <PenSquare aria-hidden />
            {t('createPost')}
          </Link>
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
        <ul className="flex flex-col gap-1" aria-label={t('filterHint')}>
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
                      ? 'border-accent bg-accent-tint'
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
  );
}
