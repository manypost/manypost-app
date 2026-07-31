'use client';

import { Bell, CalendarDays, CreditCard, House, Image as ImageIcon, LogOut, Menu, PenSquare, Plug, Search, Settings, SquareKanban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/brand/wordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout, useMe } from '@/features/auth/hooks';
import { usePlanFeatures } from '@/features/billing/hooks';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { NotificationsMenu } from '@/features/notifications/notifications-menu';
import { useCommandPalette } from '@/features/search/hooks';

const MOBILE_NAV = [
  { href: '/inicio', key: 'home', icon: House },
  { href: '/calendario', key: 'calendar', icon: CalendarDays },
  { href: '/kanban', key: 'kanban', icon: SquareKanban },
  { href: '/conexoes', key: 'connections', icon: Plug },
  { href: '/midia', key: 'media', icon: ImageIcon },
  { href: '/notificacoes', key: 'notifications', icon: Bell },
  { href: '/configuracoes', key: 'settings', icon: Settings },
] as const;

const TITLE_BY_PATH: Array<{ prefix: string; key: string }> = [
  { prefix: '/inicio', key: 'nav.home' },
  { prefix: '/calendario', key: 'nav.calendar' },
  { prefix: '/kanban', key: 'nav.kanban' },
  { prefix: '/conexoes', key: 'nav.connections' },
  { prefix: '/midia', key: 'nav.media' },
  { prefix: '/notificacoes', key: 'nav.notifications' },
  { prefix: '/configuracoes', key: 'nav.settings' },
  { prefix: '/planos', key: 'nav.plans' },
  { prefix: '/compor', key: 'nav.compose' },
];

export function Topbar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { data: me, isPending } = useMe();
  const logout = useLogout();
  const openComposer = useComposerModal((s) => s.openComposer);
  const abrirPaleta = useCommandPalette((s) => s.abrir);
  const title = TITLE_BY_PATH.find(({ prefix }) => pathname.startsWith(prefix));
  const { billingEnabled } = usePlanFeatures();
  const mobileNav = billingEnabled
    ? [...MOBILE_NAV, { href: '/planos', key: 'plans', icon: CreditCard } as const]
    : MOBILE_NAV;

  const user = me?.user;
  const initials = (user?.name ?? user?.email ?? '?')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('');

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 md:px-6">
      {/* mobile: wordmark + navegação em menu (a sidebar some < md) */}
      <div className="flex items-center gap-2 md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Menu">
              <Menu aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => openComposer()}>
              <PenSquare aria-hidden />
              {t('nav.compose')}
            </DropdownMenuItem>
            {mobileNav.map(({ href, key, icon: Icon }) => (
              <DropdownMenuItem key={href} asChild>
                <Link href={href}>
                  <Icon aria-hidden />
                  {t(`nav.${key}`)}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Wordmark />
      </div>
      {/* contexto persistente; o h1 semântico pertence ao PageHeader da tela */}
      <p className="hidden text-panel font-semibold tracking-[-0.3px] text-ink md:block">
        {title ? t(title.key) : ''}
      </p>

      <div className="flex items-center gap-2">
      {/* atalho invisível é atalho inexistente: o gatilho é o que ensina o ⌘K */}
      <button
        type="button"
        onClick={abrirPaleta}
        aria-label={t('commandPalette.open')}
        className="border-line-strong bg-surface hidden cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-meta text-graphite outline-none transition-colors duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex"
      >
        <Search className="size-3.5" aria-hidden />
        <span>{t('commandPalette.open')}</span>
        <kbd className="ml-2 rounded-sm border border-line bg-surface px-1.5 py-0.5 text-axis font-semibold">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={abrirPaleta}
        aria-label={t('commandPalette.open')}
        className="grid size-8 cursor-pointer place-items-center rounded-sm text-graphite outline-none transition-colors duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:hidden"
      >
        <Search className="size-4" aria-hidden />
      </button>
      <NotificationsMenu />
      {isPending ? (
        <Skeleton className="size-8 rounded-lg" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="cursor-pointer rounded-lg outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={user?.name ?? user?.email ?? 'menu do usuário'}
            >
              <Avatar>
                {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
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
              {t('auth.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </div>
    </header>
  );
}
