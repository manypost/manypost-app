'use client';

import { Check } from 'lucide-react';
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
 * Seleção de canais do composer (direção do Postiz): fileira de avatares —
 * apagado = fora do post, colorido com check = dentro. Só ACTIVE seleciona.
 */
export function ChannelPicker({
  selectedIds,
  onToggle,
}: {
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const t = useTranslations('composer');
  const tConn = useTranslations('connections');
  const channels = useChannels();

  if (channels.isPending) {
    return (
      <div className="flex gap-2">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="size-11 rounded-full" />
      </div>
    );
  }
  if (channels.isError || !channels.data || channels.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface-2 px-6 py-8 text-center">
        <p className="text-sm leading-relaxed text-graphite">{t('noChannels')}</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/conexoes">{t('goConnect')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2.5">
      {channels.data.map((ch) => {
        const active = ch.status === 'ACTIVE';
        const selected = selectedIds.includes(ch.id);
        const name = ch.name ?? ch.username ?? ch.id;
        return (
          <li key={ch.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={!active}
                  aria-pressed={selected}
                  aria-label={name}
                  onClick={() => onToggle(ch.id)}
                  className={cn(
                    'relative block rounded-full outline-none transition-colors duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    !active && 'cursor-not-allowed',
                  )}
                >
                  <Avatar
                    className={cn(
                      'size-11 border-2 transition-colors duration-200',
                      selected ? 'border-accent' : 'border-line',
                      !selected && 'opacity-50 grayscale',
                      !active && 'opacity-30',
                    )}
                  >
                    {ch.avatarUrl ? <AvatarImage src={ch.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {PROVIDER_ICONS[ch.provider] ? (
                    <img
                      src={PROVIDER_ICONS[ch.provider]}
                      alt=""
                      aria-hidden
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 size-4 rounded-sm border border-surface',
                        !selected && 'opacity-60 grayscale',
                      )}
                    />
                  ) : null}
                  {selected ? (
                    <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-accent text-paper">
                      <Check className="size-2.5" aria-hidden />
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {name}
                {!active
                  ? ` — ${tConn.has(`status.${ch.status}`) ? tConn(`status.${ch.status}`) : ch.status}`
                  : ''}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
