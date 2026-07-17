'use client';

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, CircleAlert, Files, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { useComposerStore } from '@/features/composer/store';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { useDuplicatePost } from '@/features/composer/use-duplicate';
import { PostDetailSheet } from '@/features/publications/post-detail-sheet';
import { useCancelPost, usePublicationsFeed, useReschedulePost } from '@/features/publications/hooks';
import { CANCELLABLE_STATES, stateBadgeVariant } from '@/features/publications/state';
import { useApiErrorMessage } from '@/lib/api/errors';
import { addDays, dayKey, startOfMonth, startOfWeek, toLocalInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { type FeedItem, MonthGrid, TimeGrid } from './calendar-grids';
import { ChannelsPanel } from './channels-panel';

type ViewMode = 'dia' | 'semana' | 'mes' | 'lista';

/** filtro de estado do modo lista (paridade Postiz: All | Scheduled | Draft | Published) */
const LIST_FILTERS: Record<string, string | undefined> = {
  todos: undefined,
  agendados: 'SCHEDULED',
  rascunhos: 'DRAFT',
  publicados: 'PUBLISHED',
};

/**
 * Calendário (SPEC_FRONTEND §3.1, direção do Postiz): painel de canais à
 * esquerda (clique filtra), visões dia/semana/mês com grade de horas e
 * lista com filtro por estado; drag-and-drop otimista com rollback.
 */
export function CalendarView() {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reschedule = useReschedulePost();
  const openComposer = useComposerModal((s) => s.openComposer);

  // ---- estado persistido na URL (?visao&data&canais&estado) ----
  const rawView = searchParams.get('visao');
  const view: ViewMode =
    rawView === 'lista' || rawView === 'mes' || rawView === 'dia' ? rawView : 'semana';
  const anchor = useMemo(() => {
    const raw = searchParams.get('data');
    const parsed = raw ? new Date(`${raw}T00:00:00`) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  }, [searchParams]);
  const channelFilter = useMemo(
    () => (searchParams.get('canais')?.split(',').filter(Boolean) ?? []) as string[],
    [searchParams],
  );
  const rawListFilter = searchParams.get('estado') ?? 'todos';
  const listFilter = rawListFilter in LIST_FILTERS ? rawListFilter : 'todos';

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const toggleChannel = useCallback(
    (id: string) => {
      const next = channelFilter.includes(id)
        ? channelFilter.filter((c) => c !== id)
        : [...channelFilter, id];
      setParams({ canais: next.join(',') || null });
    },
    [channelFilter, setParams],
  );

  // ---- janela de dados por visão ----
  const range = useMemo(() => {
    if (view === 'dia') {
      const start = new Date(anchor);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: addDays(start, 1), gridStart: start };
    }
    if (view === 'semana') {
      const start = startOfWeek(anchor);
      return { from: start, to: addDays(start, 7), gridStart: start };
    }
    if (view === 'mes') {
      const monthStart = startOfMonth(anchor);
      const gridStart = startOfWeek(monthStart);
      return { from: gridStart, to: addDays(gridStart, 42), gridStart };
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { from: start, to: null, gridStart: start };
  }, [view, anchor]);

  const feed = usePublicationsFeed({
    from: range.from.toISOString(),
    ...(range.to ? { to: range.to.toISOString() } : {}),
    ...(channelFilter.length > 0 ? { channelId: channelFilter.join(',') } : {}),
    ...(view === 'lista' && LIST_FILTERS[listFilter] ? { state: LIST_FILTERS[listFilter] } : {}),
  });

  // ---- drag otimista com rollback ----
  const [moves, setMoves] = useState<Record<string, string>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const over = event.over?.id;
    const data = event.active.data.current as { groupId: string; publishAt: string } | undefined;
    if (!over || !data || typeof over !== 'string') return;
    const current = new Date(data.publishAt);
    const next = new Date(current);

    const slot = /^slot-(\d{4}-\d{2}-\d{2})-(\d{1,2})$/.exec(over);
    const day = /^day-(\d{4}-\d{2}-\d{2})$/.exec(over);
    if (slot) {
      const [y, m, d] = slot[1]!.split('-').map(Number);
      next.setFullYear(y!, m! - 1, d!);
      next.setHours(Number(slot[2]), current.getMinutes(), 0, 0);
    } else if (day) {
      const [y, m, d] = day[1]!.split('-').map(Number);
      next.setFullYear(y!, m! - 1, d!);
    } else {
      return;
    }
    if (next.getTime() === current.getTime()) return;

    const { groupId } = data;
    setMoves((m) => ({ ...m, [groupId]: next.toISOString() }));
    const settle = () =>
      setMoves((m) => {
        const { [groupId]: _, ...rest } = m;
        return rest;
      });
    reschedule.mutate(
      { groupId, publishAt: next.toISOString() },
      {
        onSuccess: () => {
          settle();
          toast.success(t('rescheduled'));
        },
        onError: (err) => {
          settle(); // rollback visível (SPEC §5.4)
          toast.error(errorMessage(err));
        },
      },
    );
  };

  // aplica o overlay otimista e agrupa por dia
  const items = useMemo(() => {
    const raw = feed.data?.items ?? [];
    const withMoves = raw.map((item) =>
      moves[item.groupId] && item.publishAt ? { ...item, publishAt: moves[item.groupId]! } : item,
    );
    return withMoves.sort((a, b) => (a.publishAt ?? '').localeCompare(b.publishAt ?? ''));
  }, [feed.data, moves]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const item of items) {
      if (!item.publishAt) continue;
      const key = dayKey(new Date(item.publishAt));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  // ---- "+" no slot: pré-preenche o composer e abre o popup ----
  const scheduleAt = useCallback(
    (date: Date) => {
      // nunca sugerir horário no passado — cai para daqui a ~10 min
      let target = date;
      if (target.getTime() <= Date.now()) {
        target = new Date(Date.now() + 10 * 60_000);
        target.setMinutes(Math.ceil(target.getMinutes() / 5) * 5, 0, 0);
      }
      const composer = useComposerStore.getState();
      composer.setMode('schedule');
      composer.setPublishAtLocal(toLocalInput(target));
      openComposer();
    },
    [openComposer],
  );

  // ---- painel de detalhe ----
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const openItems = useMemo(
    () => items.filter((i) => i.groupId === openGroupId),
    [items, openGroupId],
  );

  // ---- ações rápidas dos cards (duplicar/remover sem abrir o painel) ----
  const tPost = useTranslations('postDetail');
  const duplicatePost = useDuplicatePost();
  const cancel = useCancelPost();
  const [removeGroupId, setRemoveGroupId] = useState<string | null>(null);
  const confirmRemove = () => {
    const id = removeGroupId;
    setRemoveGroupId(null);
    if (!id) return;
    cancel.mutate(id, {
      onSuccess: () => toast.success(tPost('cancelled')),
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  // ---- navegação por período ----
  const navigate = (dir: -1 | 1) => {
    const next =
      view === 'mes'
        ? new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
        : view === 'dia'
          ? addDays(anchor, dir)
          : addDays(startOfWeek(anchor), dir * 7);
    setParams({ data: dayKey(next) });
  };

  const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const periodLabel =
    view === 'mes'
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchor)
      : view === 'semana'
        ? `${dayFmt.format(startOfWeek(anchor))} – ${dayFmt.format(addDays(startOfWeek(anchor), 6))}`
        : view === 'dia'
          ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(anchor)
          : t('fromToday');

  const weekDays = useMemo(
    () =>
      view === 'dia'
        ? [range.gridStart]
        : Array.from({ length: 7 }, (_, i) => addDays(range.gridStart, i)),
    [view, range.gridStart],
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <ChannelsPanel
        selectedIds={channelFilter}
        onToggle={toggleChannel}
        onClear={() => setParams({ canais: null })}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* toolbar */}
        {/* toolbar responsiva com abas padronizadas */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
            {view !== 'lista' ? (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={t('previous')} onClick={() => navigate(-1)}>
                  <ChevronLeft aria-hidden />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setParams({ data: null })}>
                  {t('today')}
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t('next')} onClick={() => navigate(1)}>
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            ) : null}
            <span className="text-sm font-semibold capitalize text-ink sm:ml-2 truncate max-w-[200px] sm:max-w-none">{periodLabel}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto sm:ml-auto">
            {view === 'lista' ? (
              <Tabs value={listFilter} onValueChange={(v) => setParams({ estado: v === 'todos' ? null : v })} className="w-full sm:w-auto">
                <TabsList className="grid w-full grid-cols-4 sm:flex sm:w-auto h-11 sm:h-10 p-1">
                  <TabsTrigger value="todos" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold truncate">{t('filter.all')}</TabsTrigger>
                  <TabsTrigger value="agendados" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold truncate">{t('filter.scheduled')}</TabsTrigger>
                  <TabsTrigger value="rascunhos" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold truncate">{t('filter.drafts')}</TabsTrigger>
                  <TabsTrigger value="publicados" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold truncate">{t('filter.published')}</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}
            <Tabs value={view} onValueChange={(v) => setParams({ visao: v === 'semana' ? null : v })} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-4 sm:flex sm:w-auto h-11 sm:h-10 p-1">
                <TabsTrigger value="dia" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold truncate">{t('viewDay')}</TabsTrigger>
                <TabsTrigger value="semana" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold truncate">{t('viewWeek')}</TabsTrigger>
                <TabsTrigger value="mes" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold truncate">{t('viewMonth')}</TabsTrigger>
                <TabsTrigger value="lista" className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-[13px] font-semibold truncate">{t('viewList')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* conteúdo */}
        {feed.isPending ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : feed.isError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {errorMessage(feed.error)}
              <Button variant="outline" size="sm" onClick={() => feed.refetch()}>
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            {view === 'mes' ? (
              <MonthGrid
                gridStart={range.gridStart}
                anchorMonth={anchor.getMonth()}
                itemsByDay={itemsByDay}
                onOpen={setOpenGroupId}
                onSchedule={scheduleAt}
                onDuplicate={duplicatePost.duplicate}
                onRemove={setRemoveGroupId}
              />
            ) : view === 'lista' ? (
              <ListView
                items={items}
                onOpen={setOpenGroupId}
                onDuplicate={duplicatePost.duplicate}
                onRemove={setRemoveGroupId}
              />
            ) : (
              <TimeGrid
                days={weekDays}
                itemsByDay={itemsByDay}
                onOpen={setOpenGroupId}
                onSchedule={scheduleAt}
                onDuplicate={duplicatePost.duplicate}
                onRemove={setRemoveGroupId}
              />
            )}
          </DndContext>
        )}
      </div>

      <PostDetailSheet groupId={openGroupId} items={openItems} onClose={() => setOpenGroupId(null)} />

      {duplicatePost.dialog}

      <AlertDialog
        open={removeGroupId !== null}
        onOpenChange={(open) => !open && setRemoveGroupId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tPost('cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tPost('cancelWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tPost('keep')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>{tPost('cancelConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Modo lista (paridade Postiz): dias como cabeçalho, linhas com hora à direita;
 *  hover revela duplicar/remover no canto direito (como nos chips das grades). */
function ListView({
  items,
  onOpen,
  onDuplicate,
  onRemove,
}: {
  items: FeedItem[];
  onOpen: (groupId: string) => void;
  onDuplicate?: (groupId: string) => void;
  onRemove?: (groupId: string) => void;
}) {
  const t = useTranslations('calendar');
  const tPost = useTranslations('postDetail');
  const locale = useLocale();
  const openComposer = useComposerModal((s) => s.openComposer);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface-2 px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-graphite">{t('empty')}</p>
        <Button size="sm" className="mt-4" onClick={() => openComposer()}>
          {t('newPost')}
        </Button>
      </div>
    );
  }

  const todayKey = dayKey(new Date());
  const groups = new Map<string, FeedItem[]>();
  for (const item of items) {
    const key = item.publishAt ? dayKey(new Date(item.publishAt)) : 'sem-data';
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([key, dayItems]) => (
        <section key={key} aria-label={key} className="flex flex-col gap-2">
          <h2 className="text-center text-sm font-semibold capitalize text-graphite">
            {key === 'sem-data'
              ? t('noDate')
              : key === todayKey
                ? t('today')
                : dayLabel.format(new Date(dayItems[0]!.publishAt!))}
          </h2>
          <ul className="overflow-hidden rounded-lg border border-line bg-surface">
            {dayItems.map((item) => {
              const removable = onRemove !== undefined && CANCELLABLE_STATES.has(item.group.state);
              return (
              <li key={item.id} className="group/row relative overflow-hidden border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => onOpen(item.groupId)}
                  className={cn(
                    'flex w-full flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 border-l-2 border-l-transparent bg-surface p-3 sm:px-3 sm:py-2.5 text-left transition-colors duration-200',
                    'outline-none hover:border-l-accent hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent active:bg-surface-2',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="relative shrink-0">
                        <Avatar className="size-7">
                          {item.channel.avatarUrl ? <AvatarImage src={item.channel.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-[11px]">
                            {(item.channel.name ?? item.channel.provider).charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {PROVIDER_ICONS[item.channel.provider] ? (
                          <img
                            src={PROVIDER_ICONS[item.channel.provider]}
                            alt=""
                            aria-hidden
                            className="absolute -bottom-0.5 -right-0.5 size-3 rounded-sm border border-surface"
                          />
                        ) : null}
                      </span>
                      <span className="font-semibold text-xs text-ink sm:hidden">{item.channel.name}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
                      {item.group.awaitingApproval ? (
                        <Badge variant="review" className="text-[10px] px-1.5 py-0">{t('awaitingApproval')}</Badge>
                      ) : null}
                      <Badge variant={stateBadgeVariant(item.state)} className="text-[10px] px-1.5 py-0">
                        {t.has(`state.${item.state}`) ? t(`state.${item.state}`) : item.state}
                      </Badge>
                      <span className="text-xs font-semibold tabular-nums text-ink ml-1">
                        {item.publishAt ? timeLabel.format(new Date(item.publishAt)) : '—'}
                      </span>
                    </div>
                  </div>

                  <span className="min-w-0 flex-1 w-full sm:w-auto">
                    <span className="block text-sm font-medium text-ink line-clamp-2 sm:truncate sm:font-normal">{item.text}</span>
                    <span className="mt-1 sm:mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-graphite">
                      <span className="hidden sm:inline truncate">{item.channel.name}</span>
                      {item.mediaCount > 0 ? <span>{t('media', { count: item.mediaCount })}</span> : null}
                      {item.state === 'FAILED' && item.errorMessage ? (
                        <span className="truncate text-state-failed">· {item.errorMessage}</span>
                      ) : null}
                    </span>
                  </span>

                  <span className="hidden sm:flex shrink-0 items-center gap-2">
                    {item.group.awaitingApproval ? (
                      <Badge variant="review">{t('awaitingApproval')}</Badge>
                    ) : null}
                    <Badge variant={stateBadgeVariant(item.state)}>
                      {t.has(`state.${item.state}`) ? t(`state.${item.state}`) : item.state}
                    </Badge>
                    <span className="w-12 text-right text-[13px] font-semibold tabular-nums text-ink">
                      {item.publishAt ? timeLabel.format(new Date(item.publishAt)) : '—'}
                    </span>
                  </span>
                </button>

                {onDuplicate !== undefined || removable ? (
                  <span
                    className={cn(
                      'absolute right-0 top-0 bottom-0 hidden items-center gap-1 bg-surface px-3 sm:flex',
                      'pointer-events-none opacity-0 transition-opacity duration-200 motion-reduce:transition-none',
                      'focus-within:pointer-events-auto focus-within:opacity-100 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-hover/row:bg-surface-2 focus-within:bg-surface-2',
                    )}
                  >
                    {onDuplicate !== undefined ? (
                      <button
                        type="button"
                        aria-label={tPost('duplicate')}
                        title={tPost('duplicate')}
                        onClick={() => onDuplicate(item.groupId)}
                        className="grid size-7 place-items-center rounded-sm text-graphite outline-none transition-colors duration-200 hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent"
                      >
                        <Files className="size-3.5" aria-hidden />
                      </button>
                    ) : null}
                    {removable ? (
                      <button
                        type="button"
                        aria-label={tPost('cancelPost')}
                        title={tPost('cancelPost')}
                        onClick={() => onRemove!(item.groupId)}
                        className="grid size-7 place-items-center rounded-sm text-graphite outline-none transition-colors duration-200 hover:bg-state-failed-tint hover:text-state-failed focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </li>
            );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
