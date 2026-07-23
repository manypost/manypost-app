'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { addDays, sameDay, startOfMonth, startOfWeek } from '@/lib/datetime';
import { cn } from '@/lib/utils';

/**
 * Calendário de mês p/ seleção de data única — API espelhada do kit shadrix
 * (`mode`/`selected`/`onSelect`/`disabled`), mas implementado com a matemática
 * de datas que o app já usa no /calendario (lib/datetime) em vez de
 * react-day-picker: zero dependência nova e estilo idêntico à visão de mês
 * (hoje em círculo accent, semana começando na segunda).
 */
export function Calendar({
  selected,
  onSelect,
  disabled,
  className,
}: {
  mode?: 'single';
  selected?: Date;
  onSelect?: (date: Date) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations('dateTime');
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const today = new Date();

  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const titleFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const gridStart = startOfWeek(startOfMonth(viewMonth));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const shiftMonth = (delta: number) =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div className={cn('w-64 select-none', className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t('prevMonth')}
          onClick={() => shiftMonth(-1)}
          className="grid size-7 place-items-center rounded-md text-graphite outline-none transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="text-sm font-semibold text-ink">
          {(() => {
            const title = titleFmt.format(viewMonth);
            return title.charAt(0).toUpperCase() + title.slice(1);
          })()}
        </span>
        <button
          type="button"
          aria-label={t('nextMonth')}
          onClick={() => shiftMonth(1)}
          className="grid size-7 place-items-center rounded-md text-graphite outline-none transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center">
        {cells.slice(0, 7).map((d, i) => (
          <span key={i} className="py-1 text-[11px] font-semibold uppercase text-mist">
            {weekdayFmt.format(d).replace('.', '').slice(0, 3)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const outside = date.getMonth() !== viewMonth.getMonth();
          const isToday = sameDay(date, today);
          const isSelected = selected !== undefined && sameDay(date, selected);
          const isDisabled = disabled?.(date) ?? false;
          return (
            <button
              key={date.getTime()}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)}
              onClick={() => onSelect?.(date)}
              className={cn(
                'mx-auto my-0.5 grid size-8 place-items-center rounded-md text-[13px] tabular-nums outline-none transition-colors duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                isSelected
                  ? 'bevel-primary border font-semibold text-paper'
                  : isDisabled
                    ? 'cursor-not-allowed text-mist/50'
                    : cn(
                        'hover:bg-surface-2',
                        outside ? 'text-mist' : 'text-ink',
                        // hoje: círculo accent, como na visão de mês do calendário
                        isToday && 'rounded-full border border-accent font-semibold text-accent',
                      ),
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
