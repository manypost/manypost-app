'use client';

import { CircleAlert, ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { useApiErrorMessage } from '@/lib/api/errors';
import type { components } from '@/lib/api/schema';
import { usePublicationsFeed } from './hooks';

type FeedItem = components['schemas']['FeedItem'];

const STATE_BADGE: Record<
  string,
  'neutral' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'review'
> = {
  DRAFT: 'neutral',
  SCHEDULED: 'scheduled',
  PUBLISHING: 'publishing',
  RETRYING: 'publishing',
  TOKEN_REFRESH: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'neutral',
  NEEDS_REVIEW: 'review',
};

/** chave local YYYY-MM-DD p/ agrupar por dia no fuso do usuário */
const dayKey = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Modo lista do calendário (SPEC_FRONTEND §3.1): publicações a partir de hoje,
 * agrupadas por dia no fuso do usuário. Semana/mês/drag chegam na fatia do
 * calendário completo (@dnd-kit).
 */
export function PublicationsList() {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  // início de hoje no fuso local, estável durante a sessão da página
  const [from] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  });
  const feed = usePublicationsFeed({ from });

  if (feed.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }
  if (feed.isError) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {errorMessage(feed.error)}
          <Button variant="outline" size="sm" onClick={() => feed.refetch()}>
            {t('retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (feed.data.items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface-2 px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-graphite">{t('empty')}</p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/compor">{t('newPost')}</Link>
        </Button>
      </div>
    );
  }

  const todayKey = dayKey(new Date().toISOString());
  const groups = new Map<string, FeedItem[]>();
  for (const item of feed.data.items) {
    const key = item.publishAt ? dayKey(item.publishAt) : 'sem-data';
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeLabel = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col gap-8">
      {[...groups.entries()].map(([key, items]) => (
        <section key={key} aria-label={key} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-graphite">
            {key === 'sem-data'
              ? t('noDate')
              : key === todayKey
                ? t('today')
                : dayLabel.format(new Date(items[0]!.publishAt!))}
          </h2>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-colors duration-200 hover:border-accent">
                  <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                    {item.publishAt ? timeLabel.format(new Date(item.publishAt)) : '—'}
                  </span>
                  <span className="relative shrink-0">
                    <Avatar className="size-8">
                      {item.channel.avatarUrl ? (
                        <AvatarImage src={item.channel.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback>
                        {(item.channel.name ?? item.channel.provider).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {PROVIDER_ICONS[item.channel.provider] ? (
                      <img
                        src={PROVIDER_ICONS[item.channel.provider]}
                        alt=""
                        aria-hidden
                        className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-sm border border-surface"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{item.text}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-graphite">
                      <span className="truncate">{item.channel.name}</span>
                      {item.mediaCount > 0 ? <span>· {t('media', { count: item.mediaCount })}</span> : null}
                      {item.state === 'FAILED' && item.errorMessage ? (
                        <span className="truncate text-state-failed">· {item.errorMessage}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.group.awaitingApproval ? (
                      <Badge variant="review">{t('awaitingApproval')}</Badge>
                    ) : null}
                    <Badge variant={STATE_BADGE[item.state] ?? 'neutral'}>
                      {t.has(`state.${item.state}`) ? t(`state.${item.state}`) : item.state}
                    </Badge>
                    {item.releaseUrl ? (
                      <Button asChild variant="ghost" size="icon-sm" aria-label={t('view')}>
                        <a href={item.releaseUrl} target="_blank" rel="noreferrer noopener">
                          <ExternalLink aria-hidden />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
