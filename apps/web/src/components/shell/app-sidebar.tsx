'use client';

import { Bell, CalendarDays, Image as ImageIcon, PenSquare, Plug, Settings, SquareKanban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/brand/wordmark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { IconType } from '@/types';

const NAV: Array<{ href: string; key: string; icon: IconType }> = [
  { href: '/calendario', key: 'calendar', icon: CalendarDays },
  { href: '/kanban', key: 'kanban', icon: SquareKanban },
  { href: '/conexoes', key: 'connections', icon: Plug },
  { href: '/midia', key: 'media', icon: ImageIcon },
  { href: '/notificacoes', key: 'notifications', icon: Bell },
  { href: '/configuracoes', key: 'settings', icon: Settings },
];

export function AppSidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex h-14 items-center border-b border-line px-4">
        <Link
          href="/calendario"
          className="rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Wordmark />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label={t('calendar')}>
        <Button asChild className="mb-2">
          <Link href="/compor">
            <PenSquare aria-hidden />
            {t('compose')}
          </Link>
        </Button>
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-semibold outline-none transition-colors duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                active
                  ? 'bg-accent-tint text-accent'
                  : 'text-graphite hover:bg-surface-2 hover:text-ink',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
