'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import type { components } from '@/lib/api/schema';
import { addDays, dayKey, sameDay } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { type StateBadgeVariant, stateBadgeVariant } from '@/features/publications/state';

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

/** Chip de publicação (avatar do canal + horário + cor de estado). */
export function CalendarChip({
  item,
  onOpen,
  compact = false,
}: {
  item: FeedItem;
  onOpen: (groupId: string) => void;
  compact?: boolean;
}) {
  const locale = useLocale();
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

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(item.groupId)}
      {...listeners}
      {...attributes}
      className={cn(
        'flex w-full items-center gap-1.5 overflow-hidden rounded-sm border border-line border-l-2 bg-surface px-1.5 py-1 text-left outline-none transition-colors duration-200',
        CHIP_BORDER[stateBadgeVariant(item.state)],
        'hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        draggable ? 'cursor-grab' : 'cursor-pointer',
        isDragging && 'opacity-40',
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
  );
}

/**
 * Área vazia do slot que revela um "+" no hover/foco e agenda ali
 * (direção do Postiz). Sem deslocamento: só fade de opacidade 0.2s.
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
      className="group/add flex min-h-6 flex-1 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-md bg-accent text-paper opacity-0 transition-[opacity,background-color] duration-200 hover:bg-accent-hover group-hover/add:opacity-100 group-focus-visible/add:opacity-100 motion-reduce:transition-none"
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
}: {
  date: Date;
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey(date)}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-0 flex-col gap-1 border-b border-r border-line bg-surface p-1.5 transition-colors duration-200',
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
}: {
  gridStart: Date;
  anchorMonth: number;
  itemsByDay: Map<string, FeedItem[]>;
  onOpen: (groupId: string) => void;
  onSchedule: (date: Date) => void;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const today = new Date();
  const now = Date.now();
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="overflow-hidden rounded-lg border border-line">
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
              className={cn('min-h-24 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-surface-2')}
              header={
                <span
                  className={cn(
                    'self-end text-[11px] font-semibold tabular-nums',
                    isToday
                      ? 'grid size-5 place-items-center rounded-full bg-accent text-paper'
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
                <CalendarChip key={item.id} item={item} onOpen={onOpen} compact />
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
                      <CalendarChip key={item.id} item={item} onOpen={onOpen} />
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
  );
}

/** Slot de hora dropável — passado é hachurado e não aceita drop (Postiz). */
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
 * Grade com linhas de hora (visões dia e semana — direção do Postiz):
 * cabeçalho fixo com os dias, rolagem vertical pelas 24h, hoje em destaque.
 */
export function TimeGrid({
  days,
  itemsByDay,
  onOpen,
  onSchedule,
}: {
  days: Date[];
  itemsByDay: Map<string, FeedItem[]>;
  onOpen: (groupId: string) => void;
  onSchedule: (date: Date) => void;
}) {
  const locale = useLocale();
  const today = new Date();
  const now = Date.now();
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const hourFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const scrollRef = useRef<HTMLDivElement>(null);

  // abre a grade já perto do horário útil (7:00)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * 49 });
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

  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div ref={scrollRef} className="max-h-[calc(100dvh-220px)] overflow-y-auto">
        {/* cabeçalho dos dias — fixo durante a rolagem */}
        <div className="sticky top-0 z-10 grid border-b border-line bg-surface-2" style={{ gridTemplateColumns: cols }}>
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
                      ? 'grid size-6 -translate-y-0.5 place-items-center rounded-full bg-accent text-paper'
                      : 'text-ink',
                  )}
                >
                  {date.getDate()}
                </span>
              </span>
            );
          })}
        </div>

        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} className="grid" style={{ gridTemplateColumns: cols }}>
            <span className="-mt-2 border-r border-line px-2 pt-2 text-right text-[11px] tabular-nums text-mist">
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
                    <CalendarChip key={item.id} item={item} onOpen={onOpen} />
                  ))}
                </HourCell>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
