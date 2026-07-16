'use client';

import {
  Bell,
  CalendarDays,
  Image as ImageIcon,
  Plug,
  Settings,
  SquareKanban,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/features/notifications/hooks';
import { cn } from '@/lib/utils';
import type { IconType } from '@/types';

const MAIN_NAV: Array<{ href: string; key: string; icon: IconType }> = [
  { href: '/calendario', key: 'calendar', icon: CalendarDays },
  { href: '/kanban', key: 'kanban', icon: SquareKanban },
  { href: '/midia', key: 'media', icon: ImageIcon },
  { href: '/conexoes', key: 'connections', icon: Plug },
];

const FOOTER_NAV: Array<{ href: string; key: string; icon: IconType }> = [
  { href: '/notificacoes', key: 'notifications', icon: Bell },
  { href: '/configuracoes', key: 'settings', icon: Settings },
];

function RailItem({
  href,
  label,
  icon: Icon,
  active,
  dot,
}: {
  href: string;
  label: string;
  icon: IconType;
  active: boolean;
  dot?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex w-16 flex-col items-center gap-1 rounded-md px-1 py-2.5 outline-none transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active ? 'bg-accent-tint text-accent' : 'text-graphite hover:bg-surface-2 hover:text-ink',
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span className="text-[10px] font-semibold leading-none">{label}</span>
      {dot ? (
        <span aria-hidden className="absolute right-3 top-2 size-2 rounded-full bg-accent" />
      ) : null}
    </Link>
  );
}

/** Rail de navegação (direção do Postiz): ícone + rótulo, canais vivem no calendário. */
export function AppSidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const notifications = useNotifications();
  const unread = (notifications.data ?? []).some((n) => !n.readAt);

  return (
    <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center border-r border-line bg-surface md:flex">
      <Link
        href="/calendario"
        aria-label="manypost"
        className="grid h-14 w-full shrink-0 place-items-center border-b border-line outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <Image src="/images/logo.png" alt="manypost" width={32} height={32} className="rounded-sm" priority />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1 py-3" aria-label={t('calendar')}>
        {MAIN_NAV.map(({ href, key, icon }) => (
          <RailItem key={href} href={href} label={t(key)} icon={icon} active={pathname.startsWith(href)} />
        ))}
        <div className="mt-auto flex flex-col items-center gap-1 border-t border-line pt-3">
          {FOOTER_NAV.map(({ href, key, icon }) => (
            <RailItem
              key={href}
              href={href}
              label={t(key)}
              icon={icon}
              active={pathname.startsWith(href)}
              dot={key === 'notifications' && unread}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}
