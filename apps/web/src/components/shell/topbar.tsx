'use client';

import {
  Bell,
  CalendarDays,
  CreditCard,
  House,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  PenSquare,
  Plug,
  Search,
  Settings,
  SquareKanban,
} from 'lucide-react';
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

const ROUTE_KEYS = [
  ['/inicio', 'home'],
  ['/compor', 'compose'],
  ['/calendario', 'calendar'],
  ['/kanban', 'kanban'],
  ['/midia', 'media'],
  ['/conexoes', 'connections'],
  ['/notificacoes', 'notifications'],
  ['/configuracoes', 'settings'],
  ['/planos', 'plans'],
] as const;

export function Topbar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { data: me, isPending } = useMe();
  const logout = useLogout();
  const openComposer = useComposerModal((s) => s.openComposer);
  const abrirPaleta = useCommandPalette((s) => s.abrir);
  const { billingEnabled } = usePlanFeatures();
  const mobileNav = billingEnabled
    ? [...MOBILE_NAV, { href: '/planos', key: 'plans', icon: CreditCard } as const]
    : MOBILE_NAV;
  const routeKey = ROUTE_KEYS.find(([href]) => pathname.startsWith(href))?.[1] ?? 'home';

  const user = me?.user;
  const initials = (user?.name ?? user?.email ?? '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('');

  return (
    <header className="sticky top-0 z-40 flex h-[59px] shrink-0 items-center justify-between border-b border-line bg-main px-4 lg:flex lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2 lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-11" aria-label="Menu">
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

        <div className="hidden min-w-0 items-center gap-3 text-compact lg:flex">
          <LayoutDashboard className="size-4 text-graphite" aria-hidden />
          <span className="text-mist">/</span>
          <span className="truncate text-graphite">manypost</span>
          <span className="text-mist">/</span>
          <span className="truncate font-medium text-ink">{t(`nav.${routeKey}`)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <button
          type="button"
          onClick={abrirPaleta}
          aria-label={t('commandPalette.open')}
          className="hidden h-7 w-[138px] cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-2.5 text-meta text-graphite outline-none transition-colors duration-200 hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex"
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">{t('nav.search')}</span>
          <kbd className="rounded-compact border border-line bg-main px-1 py-0.5 text-axis">⌘K</kbd>
        </button>
        <button
          type="button"
          onClick={abrirPaleta}
          aria-label={t('commandPalette.open')}
          className="grid size-11 cursor-pointer place-items-center rounded-control text-graphite outline-none transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:hidden"
        >
          <Search className="size-4" aria-hidden />
        </button>
        <NotificationsMenu className="size-11 lg:size-8" />
        {isPending ? (
          <span className="grid size-11 place-items-center lg:size-8">
            <Skeleton className="size-8 rounded-full" />
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-11 cursor-pointer place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:size-8"
                aria-label={user?.name ?? user?.email ?? 'menu do usuário'}
              >
                <Avatar className="size-8">
                  {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="text-compact font-medium text-ink">{user?.name}</span>
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
