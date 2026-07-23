'use client';

import {
  Bell,
  CalendarDays,
  CreditCard,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings,
  SquareKanban,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlanFeatures } from '@/features/billing/hooks';
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

/** Só no gerenciado: em self-hosted não existe cobrança, então "Planos" nem aparece. */
const BILLING_NAV: { href: string; key: string; icon: IconType } = {
  href: '/planos',
  key: 'plans',
  icon: CreditCard,
};

function RailItem({
  href,
  label,
  icon: Icon,
  active,
  dot,
  collapsed,
}: {
  href: string;
  label: string;
  icon: IconType;
  active: boolean;
  dot?: boolean;
  collapsed: boolean;
}) {
  const content = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-2.5 rounded-md border border-transparent outline-none transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        collapsed ? 'h-9 w-9 justify-center mx-auto' : 'w-full h-9 px-2.5',
        active ? 'bevel-accent text-accent font-semibold' : 'text-graphite hover:bg-surface-2 hover:text-ink',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label}</span>
      ) : null}
      {dot ? (
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full bg-accent',
            collapsed ? 'absolute right-2 top-2' : 'ml-auto',
          )}
        />
      ) : null}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

/** Sidebar de navegação expansível e recolhível (direção moderna SaaS com ícone + título à direita). */
export function AppSidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const notifications = useNotifications();
  const unread = (notifications.data ?? []).some((n) => !n.readAt);
  const { billingEnabled } = usePlanFeatures();
  const footerNav = billingEnabled ? [BILLING_NAV, ...FOOTER_NAV] : FOOTER_NAV;

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('manypost:sidebar-collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem('manypost:sidebar-collapsed', String(collapsed));
  };

  return (
    <aside
      className={cn(
        'bevel-surface sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line transition-[width] duration-300 ease-in-out md:flex',
        isCollapsed ? 'w-20 items-center' : 'w-60',
      )}
    >
      {/* Cabeçalho / Logo + Botão de recolher/expandir */}
      <div
        className={cn(
          'group/header relative flex h-14 shrink-0 items-center border-b border-line transition-colors',
          isCollapsed ? 'w-full justify-center' : 'justify-between px-4',
        )}
      >
        <Link
          href="/calendario"
          aria-label="manypost"
          className={cn(
            'flex items-center gap-2.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            isCollapsed && 'transition-opacity duration-200 group-hover/header:opacity-0',
          )}
        >
          {isCollapsed ? (
            <Image src="/images/logo.png" alt="manypost" width={32} height={32} className="rounded-sm shrink-0" priority />
          ) : (
            <Wordmark className="text-base font-bold text-ink" />
          )}
        </Link>

        {isCollapsed ? (
          /* Ícone de expandir aparece em cima da logo apenas no hover da área do topo recolhida */
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => toggleCollapsed(false)}
                aria-label="Expandir menu"
                className="absolute grid size-8 place-items-center rounded-md bg-surface text-graphite opacity-0 transition-all duration-200 group-hover/header:opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent outline-none"
              >
                <PanelLeftOpen className="size-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-semibold">
              Expandir
            </TooltipContent>
          </Tooltip>
        ) : (
          /* Botão de recolher na extremidade direita quando expandido */
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => toggleCollapsed(true)}
                aria-label="Recolher menu"
                className="grid size-8 shrink-0 place-items-center rounded-md text-graphite transition-colors hover:bg-surface-2 hover:text-ink outline-none focus-visible:outline-2 focus-visible:outline-accent"
              >
                <PanelLeftClose className="size-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-semibold">
              Recolher
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Itens de navegação */}
      <nav
        className={cn(
          'flex flex-1 flex-col gap-0.5 overflow-y-auto py-3',
          isCollapsed ? 'w-full px-2 items-center' : 'w-full px-3',
        )}
        aria-label={t('calendar')}
      >
        {MAIN_NAV.map(({ href, key, icon }) => (
          <RailItem
            key={href}
            href={href}
            label={t(key)}
            icon={icon}
            active={pathname.startsWith(href)}
            collapsed={isCollapsed}
          />
        ))}

        <div
          className={cn(
            'mt-auto flex flex-col gap-0.5 border-t border-line pt-3',
            isCollapsed ? 'w-full items-center' : 'w-full',
          )}
        >
          {footerNav.map(({ href, key, icon }) => (
            <RailItem
              key={href}
              href={href}
              label={t(key)}
              icon={icon}
              active={pathname.startsWith(href)}
              dot={key === 'notifications' && unread}
              collapsed={isCollapsed}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}
