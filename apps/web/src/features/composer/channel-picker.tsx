'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useChannels } from '@/features/channels/hooks';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { cn } from '@/lib/utils';

/** Grid de canais do composer (SPEC_FRONTEND §3.3 passo 1) — só ACTIVE entra. */
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
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
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {channels.data.map((ch) => {
        const active = ch.status === 'ACTIVE';
        const selected = selectedIds.includes(ch.id);
        return (
          <li key={ch.id}>
            <button
              type="button"
              disabled={!active}
              aria-pressed={selected}
              onClick={() => onToggle(ch.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors duration-200',
                'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                selected
                  ? 'border-accent bg-accent-tint'
                  : 'border-line bg-surface hover:border-accent',
                !active && 'cursor-not-allowed opacity-60 hover:border-line',
              )}
            >
              <span className="relative shrink-0">
                <Avatar className="size-9">
                  {ch.avatarUrl ? <AvatarImage src={ch.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{(ch.name ?? ch.username ?? '?').charAt(0)}</AvatarFallback>
                </Avatar>
                {PROVIDER_ICONS[ch.provider] ? (
                  <img
                    src={PROVIDER_ICONS[ch.provider]}
                    alt=""
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 size-4 rounded-sm border border-surface"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {ch.name ?? ch.username ?? ch.id}
                </span>
                {!active ? (
                  <Badge variant="review" className="mt-1">
                    {tConn.has(`status.${ch.status}`) ? tConn(`status.${ch.status}`) : ch.status}
                  </Badge>
                ) : ch.username ? (
                  <span className="block truncate text-xs text-graphite">
                    @{ch.username.replace(/^@/, '')}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-200',
                  selected ? 'border-accent bg-accent text-paper' : 'border-line bg-surface',
                )}
              >
                {selected ? <Check className="size-3" /> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
