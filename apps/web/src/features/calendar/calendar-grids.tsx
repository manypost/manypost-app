'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Files, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import type { components } from '@/lib/api/schema';
import { addDays, dayKey, sameDay } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  CANCELLABLE_STATES,
  type StateBadgeVariant,
  stateBadgeVariant,
} from '@/features/publications/state';

export type FeedItem = components['schemas']['FeedItem'];

/** borda esquerda do chip na cor do estado (tokens --state-*) */
const CHIP_BORDER: Record<StateBadgeVariant, string> = {
  neutral: 'border-l-mist',
  scheduled: 'border-l-state-scheduled',
  publishing: 'border-l-state-publishing',
  published: 'border-l-state-published',
  failed: 'border-l-state-failed',
  review: 'border-l-state-review',
};

/** grupos pendentes podem ser arrastados; rascunho com link pendente não (editar revoga o link) */
export const isDraggable = (item: FeedItem) =>
  (item.group.state === 'SCHEDULED' || (item.group.state === 'DRAFT' && !item.group.awaitingApproval)) &&
  item.publishAt !== null;

/**
 * Chip de publicação (avatar do canal + horário + cor de estado). Com
 * onDuplicate/onRemove, o hover/foco revela ações rápidas no canto direito
 * (fade de opacidade 0.2s — sem deslocamento; remover só em estados canceláveis).
 */
export function CalendarChip({
  item,
  onOpen,
  onDuplicate,
  onRemove,
  compact = false,
}: {
  item: FeedItem;
  onOpen: (groupId: string) => void;
  onDuplicate?: (groupId: string) => void;
  onRemove?: (groupId: string) => void;
  compact?: boolean;
}) {
  const locale = useLocale();
  const tPost = useTranslations('postDetail');
  const draggable = isDraggable(item);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { groupId: item.groupId, publishAt: item.publishAt },
    disabled: !draggable,
  });

  const time = item.publishAt
    ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
        new Date(item.publishAt),
      )
    : '—';

  const removable = onRemove !== undefined && CANCELLABLE_STATES.has(item.group.state);
  const hasActions = onDuplicate !== undefined || removable;

  return (
    <div
      className={cn(
        'group/chip relative flex w-full items-center overflow-hidden rounded-sm border border-line border-l-2 bg-surface transition-colors duration-200',
        CHIP_BORDER[stateBadgeVariant(item.state)],
        'hover:border-accent focus-within:border-accent active:bg-surface-2',
        isDragging && 'opacity-40',
        hasActions && 'min-w-0',
      )}
    >
      <button
        ref={setNodeRef}
        type="button"
        onClick={() => onOpen(item.groupId)}
        {...listeners}
        {...attributes}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-left outline-none transition-colors duration-200',
          'focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent',
          draggable ? 'cursor-grab' : 'cursor-pointer',
        )}
      >
        <span className="relative shrink-0">
          <Avatar className="size-4">
            {item.channel.avatarUrl ? <AvatarImage src={item.channel.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[9px]">
              {(item.channel.name ?? item.channel.provider).charAt(0)}
            </AvatarFallback>
          </Avatar>
          {PROVIDER_ICONS[item.channel.provider] ? (
            <img
              src={PROVIDER_ICONS[item.channel.provider]}
              alt=""
              aria-hidden
              className="absolute -bottom-1 -right-1 size-2.5 rounded-sm"
            />
          ) : null}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink">{time}</span>
        {!compact ? (
          <span className="min-w-0 flex-1 truncate text-[11px] text-graphite">{item.text}</span>
        ) : null}
      </button>

      {hasActions && !isDragging ? (
        <span
          className={cn(
            'absolute right-0 top-0 bottom-0 flex items-center gap-0.5 bg-surface px-1',
            'pointer-events-none opacity-0 transition-opacity duration-200 motion-reduce:transition-none',
            'focus-within:pointer-events-auto focus-within:opacity-100 group-hover/chip:pointer-events-auto group-hover/chip:opacity-100 group-hover/chip:bg-surface',
          )}
        >
          {onDuplicate ? (
            <button
              type="button"
              aria-label={tPost('duplicate')}
              title={tPost('duplicate')}
              onClick={() => onDuplicate(item.groupId)}
              className="grid size-5 place-items-center rounded-sm text-graphite outline-none transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent"
            >
              <Files className="size-3" aria-hidden />
            </button>
          ) : null}
          {removable ? (
            <button
              type="button"
              aria-label={tPost('cancelPost')}
              title={tPost('cancelPost')}
              onClick={() => onRemove!(item.groupId)}
              className="grid size-5 place-items-center rounded-sm text-graphite outline-none transition-colors duration-200 hover:bg-state-failed-tint hover:text-state-failed focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent"
            >
              <Trash2 className="size-3" aria-hidden />
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Área vazia do slot que revela um "+" no hover/foco (e visível sutil no touch/mobile).
 */
function SlotAddButton({ date, onSchedule }: { date: Date; onSchedule: (date: Date) => void }) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const label = t('scheduleAt', {
    date: new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => onSchedule(date)}
      className="group/add flex min-h-6 flex-1 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent active:bg-accent-tint"
    >
      <span
        aria-hidden
        className="bevel-primary grid size-6 place-items-center rounded-md border text-paper opacity-30 md:opacity-0 transition-[opacity,filter] duration-200 hover:brightness-95 group-hover/add:opacity-100 group-focus-visible/add:opacity-100 active:opacity-100 motion-reduce:transition-none"
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
      </span>
    </button>
  );
}

/** Célula-dia dropável (grade mensal). */
function DayCell({
  date,
  children,
  className,
  header,
  past,
}: {
  date: Date;
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  past?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey(date)}`, disabled: past });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-0 flex-col gap-1 border-b border-r border-line p-1.5 transition-colors duration-200',
        past ? 'cal-past' : 'bg-surface',
        isOver && 'bg-accent-tint',
        className,
      )}
    >
      {header}
      {children}
    </div>
  );
}

const MAX_VISIBLE_MONTH = 3;

/** Grade mensal: 6 semanas × 7 dias, chips compactos + popover "+N". */
export function MonthGrid({
  gridStart,
  anchorMonth,
  itemsByDay,
  onOpen,
  onSchedule,
  onDuplicate,
  onRemove,
}: {
  gridStart: Date;
  anchorMonth: number;
  itemsByDay: Map<string, FeedItem[]>;
  onOpen: (groupId: string) => void;
  onSchedule: (date: Date) => void;
  onDuplicate?: (groupId: string) => void;
  onRemove?: (groupId: string) => void;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const today = new Date();
  const now = Date.now();
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // Estado da agenda mobile para o dia tocado pelo usuário
  const [selectedKey, setSelectedKey] = useState<string>(() => dayKey(today));
  const selectedDate = useMemo(() => {
    const found = days.find((d) => dayKey(d) === selectedKey);
    return found ?? today;
  }, [days, selectedKey, today]);
  const selectedItems = itemsByDay.get(selectedKey) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* --- DESKTOP ONLY (md+): Grade mensal completa --- */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-line bg-surface">
        <div className="grid grid-cols-7 border-b border-line bg-surface-2">
          {days.slice(0, 7).map((d) => (
            <span
              key={dayKey(d)}
              className="border-r border-line px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-graphite last:border-r-0"
            >
              {weekdayFmt.format(d)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date) => {
            const key = dayKey(date);
            const items = itemsByDay.get(key) ?? [];
            const inMonth = date.getMonth() === anchorMonth;
            const isToday = sameDay(date, today);
            const overflow = items.length - MAX_VISIBLE_MONTH;
            // dia ainda aberto pode receber post; padrão de manhã (9h)
            const canAdd = addDays(date, 1).getTime() > now;
            const dayTarget = new Date(date);
            dayTarget.setHours(9, 0, 0, 0);
            return (
              <DayCell
                key={key}
                date={date}
                past={!canAdd}
                className={cn('min-h-24 [&:nth-child(7n)]:border-r-0', !inMonth && !canAdd ? 'opacity-60' : !inMonth && 'bg-surface-2')}
                header={
                  <span
                    className={cn(
                      'self-end text-[11px] font-semibold tabular-nums',
                      isToday
                        ? 'grid size-5 place-items-center rounded-full bevel-primary border text-paper'
                        : inMonth
                          ? 'text-ink'
                          : 'text-mist',
                    )}
                  >
                    {date.getDate()}
                  </span>
                }
              >
                {items.slice(0, MAX_VISIBLE_MONTH).map((item) => (
                  <CalendarChip
                    key={item.id}
                    item={item}
                    onOpen={onOpen}
                    onDuplicate={onDuplicate}
                    onRemove={onRemove}
                    compact
                  />
                ))}
                {overflow > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="rounded-sm px-1 text-left text-[11px] font-semibold text-accent outline-none transition-colors duration-200 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      >
                        {t('more', { count: overflow })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="flex w-64 flex-col gap-1 p-2" align="start">
                      {items.map((item) => (
                        <CalendarChip
                          key={item.id}
                          item={item}
                          onOpen={onOpen}
                          onDuplicate={onDuplicate}
                          onRemove={onRemove}
                        />
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : null}
                {canAdd ? <SlotAddButton date={dayTarget} onSchedule={onSchedule} /> : null}
              </DayCell>
            );
          })}
        </div>
      </div>

      {/* --- MOBILE ONLY (< md): Mini-grade interativa com pontos de status + Agenda do Dia --- */}
      <div className="flex md:hidden flex-col gap-4">
        <div className="overflow-hidden rounded-lg border border-line bg-surface p-2">
          <div className="grid grid-cols-7 pb-2 mb-1 border-b border-line">
            {days.slice(0, 7).map((d) => (
              <span
                key={dayKey(d)}
                className="text-center text-[11px] font-semibold uppercase tracking-wide text-graphite"
              >
                {weekdayFmt.format(d)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const key = dayKey(date);
              const items = itemsByDay.get(key) ?? [];
              const inMonth = date.getMonth() === anchorMonth;
              const isToday = sameDay(date, today);
              const isPastDay = addDays(date, 1).getTime() <= now;
              const isSelected = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={cn(
                    'flex flex-col items-center justify-start min-h-[50px] py-1 px-0.5 rounded-md transition-colors outline-none focus-visible:outline-2 focus-visible:outline-accent',
                    isPastDay && !isSelected && 'cal-past opacity-80',
                    !inMonth && 'opacity-40 bg-surface-2/50',
                    isSelected && 'bg-accent-tint border border-accent',
                    !isSelected && !isPastDay && 'hover:bg-surface-2',
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums flex items-center justify-center size-6 rounded-full',
                      isToday
                        ? 'bevel-primary border text-paper'
                        : isSelected
                          ? 'text-accent font-bold'
                          : 'text-ink',
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {items.length > 0 ? (
                    <div className="flex items-center justify-center gap-0.5 mt-1 flex-wrap max-w-full px-0.5">
                      {items.slice(0, 4).map((item, idx) => {
                        const variant = stateBadgeVariant(item.state);
                        const bgColors: Record<typeof variant, string> = {
                          neutral: 'bg-mist',
                          scheduled: 'bg-state-scheduled',
                          publishing: 'bg-state-publishing',
                          published: 'bg-state-published',
                          failed: 'bg-state-failed',
                          review: 'bg-state-review',
                        };
                        return (
                          <span
                            key={idx}
                            className={cn('size-1.5 rounded-full shrink-0', bgColors[variant])}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-center text-mist mt-2 pt-1.5 border-t border-line">
            {t.has('selectedDayHint') ? t('selectedDayHint') : 'Toque em um dia no calendário para ver sua agenda'}
          </p>
        </div>

        {/* Agenda do Dia mobile */}
        <section aria-label="Agenda do Dia" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wide text-graphite">
                {t.has('mobileAgendaTitle') ? t('mobileAgendaTitle') : 'Agenda do Dia'}
              </span>
              <h3 className="text-sm font-bold capitalize text-ink">
                {new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate)}
              </h3>
            </div>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-graphite">
              {selectedItems.length} {selectedItems.length === 1 ? 'post' : 'posts'}
            </span>
          </div>

          {selectedItems.length === 0 ? (
            <div className="rounded-md border border-dashed border-line bg-surface-2 px-4 py-8 text-center">
              <p className="text-xs leading-relaxed text-graphite">
                {t.has('mobileAgendaEmpty') ? t('mobileAgendaEmpty') : 'Nenhum post agendado para este dia.'}
              </p>
              <Button
                size="sm"
                onClick={() => {
                  const target = new Date(selectedDate);
                  target.setHours(9, 0, 0, 0);
                  onSchedule(target);
                }}
                className="mt-3 gap-1.5 font-semibold"
              >
                <Plus className="size-4" aria-hidden />
                {t('newPost')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedItems.map((item) => (
                <CalendarChip
                  key={item.id}
                  item={item}
                  onOpen={onOpen}
                  onDuplicate={onDuplicate}
                  onRemove={onRemove}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const target = new Date(selectedDate);
                  target.setHours(9, 0, 0, 0);
                  onSchedule(target);
                }}
                className="mt-2 gap-1.5 w-full font-semibold"
              >
                <Plus className="size-4" aria-hidden />
                {t('newPost')}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Slot de hora dropável — passado é hachurado e não aceita drop. */
function HourCell({
  date,
  hour,
  past,
  onSchedule,
  children,
}: {
  date: Date;
  hour: number;
  past: boolean;
  onSchedule: (date: Date) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${dayKey(date)}-${hour}`,
    disabled: past,
  });
  const slotStart = new Date(date);
  slotStart.setHours(hour, 0, 0, 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-12 min-w-0 flex-col gap-1 border-b border-r border-line p-1 transition-colors duration-200 last:border-r-0',
        past ? 'cal-past' : 'bg-surface',
        isOver && 'bg-accent-tint',
      )}
    >
      {children}
      {!past ? <SlotAddButton date={slotStart} onSchedule={onSchedule} /> : null}
    </div>
  );
}

/**
 * Grade com linhas de hora para as visões dia e semana:
 * cabeçalho fixo com os dias, rolagem vertical pelas 24h, hoje em destaque.
 */
export function TimeGrid({
  days,
  itemsByDay,
  onOpen,
  onSchedule,
  onDuplicate,
  onRemove,
}: {
  days: Date[];
  itemsByDay: Map<string, FeedItem[]>;
  onOpen: (groupId: string) => void;
  onSchedule: (date: Date) => void;
  onDuplicate?: (groupId: string) => void;
  onRemove?: (groupId: string) => void;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const today = new Date();
  const now = Date.now();
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const hourFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const scrollRefDesktop = useRef<HTMLDivElement>(null);
  const scrollRefMobile = useRef<HTMLDivElement>(null);

  // abre a grade já perto do horário útil (7:00)
  useEffect(() => {
    scrollRefDesktop.current?.scrollTo({ top: 7 * 49 });
    scrollRefMobile.current?.scrollTo({ top: 7 * 56 });
  }, []);

  // agrupa por (dia, hora)
  const byHour = new Map<string, FeedItem[]>();
  for (const [key, items] of itemsByDay) {
    for (const item of items) {
      if (!item.publishAt) continue;
      const hour = new Date(item.publishAt).getHours();
      const slot = `${key}-${hour}`;
      const list = byHour.get(slot) ?? [];
      list.push(item);
      byHour.set(slot, list);
    }
  }

  const colsDesktop = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const isWeekView = days.length > 1;

  // Estado e memorização do dia ativo para o mobile
  const [mobileSelectedKey, setMobileSelectedKey] = useState<string>(() => dayKey(today));
  const mobileActiveDate = useMemo(() => {
    const found = days.find((d) => dayKey(d) === mobileSelectedKey);
    return found ?? days[0] ?? today;
  }, [days, mobileSelectedKey, today]);

  const activeDateKey = dayKey(mobileActiveDate);
  const activeDateItems = itemsByDay.get(activeDateKey) ?? [];
  const activeDateFormatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(mobileActiveDate);

  return (
    <div className="flex flex-col gap-4">
      {/* --- DESKTOP ONLY (md+): Grade original de colunas paralelas --- */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-line bg-surface">
        <div ref={scrollRefDesktop} className="max-h-[calc(100dvh-220px)] overflow-y-auto">
          {/* cabeçalho dos dias — fixo durante a rolagem */}
          <div className="sticky top-0 z-10 grid border-b border-line bg-surface-2" style={{ gridTemplateColumns: colsDesktop }}>
            <span className="border-r border-line" />
            {days.map((date) => {
              const isToday = sameDay(date, today);
              return (
                <span
                  key={dayKey(date)}
                  className="flex items-baseline justify-center gap-1.5 border-r border-line px-2 py-2 last:border-r-0"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-graphite">
                    {weekdayFmt.format(date)}
                  </span>
                  <span
                    className={cn(
                      'text-[13px] font-semibold tabular-nums',
                      isToday
                        ? 'grid size-6 -translate-y-0.5 place-items-center rounded-full bevel-primary border text-paper'
                        : 'text-ink',
                    )}
                  >
                    {date.getDate()}
                  </span>
                </span>
              );
            })}
          </div>

          {Array.from({ length: 24 }, (_, hour) => {
            const isPastRow = days.every((d) => {
              const sEnd = new Date(d);
              sEnd.setHours(hour + 1, 0, 0, 0);
              return sEnd.getTime() <= now;
            });
            return (
              <div key={hour} className="grid" style={{ gridTemplateColumns: colsDesktop }}>
                <span
                  className={cn(
                    '-mt-2 border-r border-line px-2 pt-2 text-right text-[11px] tabular-nums text-mist transition-colors',
                    isPastRow && 'cal-past opacity-80',
                  )}
                >
                  {hourFmt.format(new Date(2026, 0, 1, hour))}
                </span>
              {days.map((date) => {
                const slotEnd = new Date(date);
                slotEnd.setHours(hour + 1, 0, 0, 0);
                return (
                  <HourCell
                    key={`${dayKey(date)}-${hour}`}
                    date={date}
                    hour={hour}
                    past={slotEnd.getTime() <= now}
                    onSchedule={onSchedule}
                  >
                    {(byHour.get(`${dayKey(date)}-${hour}`) ?? []).map((item) => (
                      <CalendarChip
                        key={item.id}
                        item={item}
                        onOpen={onOpen}
                        onDuplicate={onDuplicate}
                        onRemove={onRemove}
                      />
                    ))}
                  </HourCell>
                );
              })}
            </div>
          );
        })}
        </div>
      </div>

      {/* --- MOBILE ONLY (< md): Seletor da Semana espaçoso + Linha do Tempo do Dia focada --- */}
      <div className="flex md:hidden flex-col gap-3">
        {isWeekView ? (
          <div className="overflow-hidden rounded-lg border border-line bg-surface p-2">
            <div className="grid grid-cols-7 gap-1">
              {days.map((date) => {
                const key = dayKey(date);
                const items = itemsByDay.get(key) ?? [];
                const isToday = sameDay(date, today);
                const isSelected = key === activeDateKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMobileSelectedKey(key)}
                    className={cn(
                      'flex flex-col items-center justify-start min-h-[56px] py-1.5 px-0.5 rounded-md transition-all outline-none focus-visible:outline-2 focus-visible:outline-accent',
                      isSelected && 'bg-accent-tint border border-accent',
                      !isSelected && 'hover:bg-surface-2',
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-graphite mb-0.5">
                      {weekdayFmt.format(date)}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-bold tabular-nums flex items-center justify-center size-6 rounded-full',
                        isToday
                          ? 'bevel-primary border text-paper'
                          : isSelected
                            ? 'text-accent font-extrabold'
                            : 'text-ink',
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {items.length > 0 ? (
                      <div className="flex items-center justify-center gap-0.5 mt-1 flex-wrap max-w-full px-0.5">
                        {items.slice(0, 3).map((item, idx) => {
                          const variant = stateBadgeVariant(item.state);
                          const bgColors: Record<typeof variant, string> = {
                            neutral: 'bg-mist',
                            scheduled: 'bg-state-scheduled',
                            publishing: 'bg-state-publishing',
                            published: 'bg-state-published',
                            failed: 'bg-state-failed',
                            review: 'bg-state-review',
                          };
                          return (
                            <span
                              key={idx}
                              className={cn('size-1.5 rounded-full shrink-0', bgColors[variant])}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Cabeçalho do dia ativo com respiro visual */}
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-3.5">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              {isWeekView ? 'Linha do Tempo 24h' : 'Visão do Dia'}
            </span>
            <h3 className="text-sm font-bold capitalize text-ink truncate mt-0.5">
              {activeDateFormatted}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-graphite">
              {activeDateItems.length} {activeDateItems.length === 1 ? 'post' : 'posts'}
            </span>
            <Button
              size="sm"
              onClick={() => {
                const target = new Date(mobileActiveDate);
                target.setHours(9, 0, 0, 0);
                onSchedule(target);
              }}
              className="gap-1 px-2.5 font-semibold"
            >
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t('newPost')}</span>
            </Button>
          </div>
        </div>

        {/* Linha do Tempo 24h para o dia único no mobile (respiro visual, slots de 56px, chips 100% de largura) */}
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div ref={scrollRefMobile} className="max-h-[calc(100dvh-280px)] overflow-y-auto">
            {Array.from({ length: 24 }, (_, hour) => {
              const slotEnd = new Date(mobileActiveDate);
              slotEnd.setHours(hour + 1, 0, 0, 0);
              const isPast = slotEnd.getTime() <= now;
              const slotItems = byHour.get(`${activeDateKey}-${hour}`) ?? [];

              return (
                <div
                  key={hour}
                  className="grid grid-cols-[56px_minmax(0,1fr)] min-h-[56px]"
                >
                  <span
                    className={cn(
                      'border-b border-r border-line px-2 pt-2.5 text-right text-xs font-medium tabular-nums transition-colors',
                      isPast ? 'cal-past text-mist opacity-80' : 'bg-surface-2/40 text-graphite',
                    )}
                  >
                    {hourFmt.format(new Date(2026, 0, 1, hour))}
                  </span>
                  <HourCell
                    date={mobileActiveDate}
                    hour={hour}
                    past={isPast}
                    onSchedule={onSchedule}
                  >
                    {slotItems.map((item) => (
                      <CalendarChip
                        key={item.id}
                        item={item}
                        onOpen={onOpen}
                        onDuplicate={onDuplicate}
                        onRemove={onRemove}
                      />
                    ))}
                  </HourCell>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
