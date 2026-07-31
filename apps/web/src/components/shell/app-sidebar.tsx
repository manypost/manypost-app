'use client';

import {
  Bell,
  CalendarDays,
  CreditCard,
  Image as ImageIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Plug,
  Search,
  House,
  Settings,
  SquareKanban,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/brand/brand-mark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLogout, useMe } from '@/features/auth/hooks';
import { usePlanFeatures } from '@/features/billing/hooks';
import { useNotifications } from '@/features/notifications/hooks';
import { useCommandPalette } from '@/features/search/hooks';
import { cn } from '@/lib/utils';
import type { IconType } from '@/types';

const MAIN_NAV: Array<{ href: string; key: string; icon: IconType }> = [
  // Início primeiro: é a âncora da navegação. Sem ela, o produto não tinha "começo" — e o
  // wordmark levava ao calendário, então nem o gesto universal de voltar ao início existia.
  { href: '/inicio', key: 'home', icon: House },
  { href: '/compor', key: 'compose', icon: PenSquare },
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
        active
          ? 'bg-sidebar-hover text-sidebar-text font-semibold'
          : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate text-compact font-medium">{label}</span>
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
  const { data: me, isPending: mePending } = useMe();
  const logout = useLogout();
  const abrirPaleta = useCommandPalette((s) => s.abrir);
  const footerNav = billingEnabled ? [BILLING_NAV, ...FOOTER_NAV] : FOOTER_NAV;
  const user = me?.user;
  const initials = (user?.name ?? user?.email ?? '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('');

  const [isCollapsed, setIsCollapsed] = useState(false);
  /** Só true após ler localStorage — evita spin da logo no reload. */
  const [sidebarReady, setSidebarReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('manypost:sidebar-collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
    setSidebarReady(true);
  }, []);

  const toggleCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem('manypost:sidebar-collapsed', String(collapsed));
  };

  return (
    <aside
      className={cn(
        'bg-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-hover transition-[width] duration-300 ease-in-out md:flex',
        isCollapsed ? 'w-16 items-center' : 'w-52',
      )}
    >
      {/* Cabeçalho / Logo + Botão de recolher/expandir */}
      <div
        className={cn(
          'group/header relative flex h-16 shrink-0 items-center border-b border-sidebar-hover transition-colors',
          isCollapsed ? 'w-full justify-center' : 'justify-between px-4',
        )}
      >
        <Link
          href="/inicio"
          aria-label="manypost"
          className={cn(
            'flex items-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-on-dark',
            isCollapsed && 'transition-opacity duration-200 group-hover/header:opacity-0',
          )}
        >
          <BrandMark compact={isCollapsed} ready={sidebarReady} />
        </Link>

        {isCollapsed ? (
          /* Ícone de expandir aparece em cima da logo apenas no hover da área do topo recolhida */
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => toggleCollapsed(false)}
                aria-label="Expandir menu"
                className="absolute grid size-8 place-items-center rounded-md bg-sidebar text-sidebar-muted opacity-0 transition-all duration-200 group-hover/header:opacity-100 hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-on-dark outline-none"
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
                className="grid size-8 shrink-0 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text outline-none focus-visible:outline-2 focus-visible:outline-accent-on-dark"
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
          'flex flex-1 flex-col gap-1 overflow-y-auto py-3',
          isCollapsed ? 'w-full px-2 items-center' : 'w-full px-3',
        )}
        aria-label={t('navigation')}
      >
        <button
          type="button"
          onClick={abrirPaleta}
          aria-label={t('search')}
          className={cn(
            'mb-2 flex h-9 cursor-pointer items-center rounded-md border border-sidebar-hover text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:outline-2 focus-visible:outline-accent-on-dark',
            isCollapsed ? 'w-9 justify-center' : 'w-full gap-2.5 px-2.5',
          )}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          {!isCollapsed ? <span className="truncate text-compact font-medium">{t('search')}</span> : null}
        </button>
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
            'mt-auto flex flex-col gap-1 border-t border-sidebar-hover pt-3',
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

      <div className="border-t border-sidebar-hover p-2">
        {mePending ? (
          <Skeleton className="h-10 rounded-md bg-sidebar-hover" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-11 w-full cursor-pointer items-center rounded-md text-left text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:outline-2 focus-visible:outline-accent-on-dark',
                  isCollapsed ? 'justify-center' : 'gap-2.5 px-2',
                )}
                aria-label={user?.name ?? user?.email ?? t('account')}
              >
                <Avatar className="size-7">
                  {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-sidebar-hover text-sidebar-text">{initials}</AvatarFallback>
                </Avatar>
                {!isCollapsed ? (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-compact font-medium text-sidebar-text">
                      {user?.name ?? user?.email}
                    </span>
                    <span className="block truncate text-meta text-sidebar-muted">{t('account')}</span>
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="min-w-52">
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="text-compact font-semibold text-ink">{user?.name}</span>
                <span className="font-normal">{user?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => logout.mutate()}
                className="text-state-failed focus:text-state-failed [&_svg]:text-state-failed"
              >
                <LogOut aria-hidden />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
