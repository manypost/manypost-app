'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { relativeTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from './hooks';

/** Sino do topbar: contagem de não lidas + últimas notificações. */
export function NotificationsMenu() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  const recent = items.slice(0, 6);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('bell', { count: unread })} className="relative">
          <Bell aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="bevel-chip absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-paper"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-[13px] font-semibold text-ink">{t('title')}</span>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2"
              onClick={() => markAll.mutate()}
              isLoading={markAll.isPending}
            >
              <CheckCheck aria-hidden />
              {t('markAll')}
            </Button>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-graphite">{t('empty')}</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {recent.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n.id);
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2.5 text-left outline-none transition-colors duration-200 hover:bg-surface-2 focus-visible:bg-surface-2',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      n.readAt ? 'bg-line' : 'bg-accent',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[13px]', n.readAt ? 'text-graphite' : 'font-semibold text-ink')}>
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-graphite">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-xs text-mist">
                      {relativeTime(n.createdAt, locale)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line p-1">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center">
            <Link href="/notificacoes">{t('seeAll')}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
