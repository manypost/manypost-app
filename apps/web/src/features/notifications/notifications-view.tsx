'use client';

import { CheckCheck, CircleAlert, Inbox } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiErrorMessage } from '@/lib/api/errors';
import { relativeTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from './hooks';

/** Página de notificações: clique marca como lida; "marcar todas" no topo. */
export function NotificationsView() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (notifications.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }
  if (notifications.isError) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {errorMessage(notifications.error)}
          <Button variant="outline" size="sm" onClick={() => notifications.refetch()}>
            {t('retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const items = notifications.data;
  const unread = items.filter((n) => !n.readAt).length;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface-2 px-6 py-16 text-center">
        <Inbox className="size-8 text-mist" aria-hidden />
        <p className="text-sm leading-relaxed text-graphite">{t('emptyPage')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {unread > 0 ? (
        <div className="bevel-chip flex items-center justify-between rounded-lg border border-line bg-accent-tint px-4 py-2.5">
          <span className="text-[13px] font-semibold text-accent">
            {t('unreadCount', { count: unread })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => markAll.mutate()}
            isLoading={markAll.isPending}
          >
            <CheckCheck aria-hidden />
            {t('markAll')}
          </Button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-2">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => {
                if (!n.readAt) markRead.mutate(n.id);
              }}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-4 text-left outline-none transition-colors duration-200',
                'hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                n.readAt ? 'bevel-surface' : 'bevel-accent',
              )}
            >
              <span
                aria-hidden
                className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-line' : 'bg-accent')}
              />
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm', n.readAt ? 'text-graphite' : 'font-semibold text-ink')}>
                  {n.title}
                </span>
                {n.body ? (
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-graphite">{n.body}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-mist">{relativeTime(n.createdAt, locale)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
