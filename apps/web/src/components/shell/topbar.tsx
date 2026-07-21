'use client';

import { Bell, CalendarDays, Image as ImageIcon, LogOut, Menu, PenSquare, Plug, Settings, SquareKanban } from 'lucide-react';
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
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { NotificationsMenu } from '@/features/notifications/notifications-menu';

const MOBILE_NAV = [
  { href: '/calendario', key: 'calendar', icon: CalendarDays },
  { href: '/kanban', key: 'kanban', icon: SquareKanban },
  { href: '/conexoes', key: 'connections', icon: Plug },
  { href: '/midia', key: 'media', icon: ImageIcon },
  { href: '/notificacoes', key: 'notifications', icon: Bell },
  { href: '/configuracoes', key: 'settings', icon: Settings },
] as const;

const TITLE_BY_PATH: Array<{ prefix: string; key: string }> = [
  { prefix: '/calendario', key: 'nav.calendar' },
  { prefix: '/kanban', key: 'nav.kanban' },
  { prefix: '/conexoes', key: 'nav.connections' },
  { prefix: '/midia', key: 'nav.media' },
  { prefix: '/notificacoes', key: 'nav.notifications' },
  { prefix: '/configuracoes', key: 'nav.settings' },
  { prefix: '/compor', key: 'nav.compose' },
];

export function Topbar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { data: me, isPending } = useMe();
  const logout = useLogout();
  const openComposer = useComposerModal((s) => s.openComposer);
  const title = TITLE_BY_PATH.find(({ prefix }) => pathname.startsWith(prefix));

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
            {MOBILE_NAV.map(({ href, key, icon: Icon }) => (
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
      {/* título da página (padrão do Postiz: título vive na topbar) */}
      <h1 className="hidden text-lg font-semibold tracking-[-0.3px] text-ink md:block">
        {title ? t(title.key) : ''}
      </h1>

      <div className="flex items-center gap-2">
      <NotificationsMenu />
      {isPending ? (
        <Skeleton className="size-8 rounded-full" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={user?.name ?? user?.email ?? 'menu do usuário'}
            >
              <Avatar>
                {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-ink">{user?.name}</span>
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
