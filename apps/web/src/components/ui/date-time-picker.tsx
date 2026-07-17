'use client';

import { CalendarDays, Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toLocalInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';

/**
 * Seletor de data+hora no brand system (substitui o <input type="datetime-local">
 * padrão do navegador): botão com a data formatada → popover com o Calendar
 * (ui/calendar) + campo de hora. Mesmo contrato de valor do input nativo
 * (string local "YYYY-MM-DDTHH:mm" — toLocalInput), então é drop-in nos usos.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  min,
  ariaLabel,
  className,
}: {
  id?: string;
  /** formato do datetime-local ("2026-07-18T09:00"); vazio = sem valor */
  value: string;
  onChange: (value: string) => void;
  /** datas anteriores ao DIA de `min` ficam desabilitadas (a hora é validada por quem usa) */
  min?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations('dateTime');
  const [open, setOpen] = useState(false);

  const parsed = value ? new Date(value) : undefined;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeValue = date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '09:00';

  const minDay = (() => {
    if (!min) return undefined;
    const d = new Date(min);
    if (Number.isNaN(d.getTime())) return undefined;
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const selectDay = (day: Date) => {
    const [h, m] = timeValue.split(':').map(Number);
    onChange(
      toLocalInput(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h ?? 9, m ?? 0)),
    );
  };

  const changeTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    if (h === undefined || Number.isNaN(h)) return;
    const base = date ?? new Date();
    onChange(
      toLocalInput(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m ?? 0)),
    );
  };

  const formatted = date
    ? new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : t('pick');
  // só a 1ª letra maiúscula ("Sex., 17 de jul., 08:00" — capitalize por CSS subiria cada palavra)
  const label = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={ariaLabel ?? t('pick')}
          className={cn(
            'flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors duration-200',
            'hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            !date && 'text-graphite',
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-graphite" aria-hidden />
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <Calendar
          selected={date}
          onSelect={selectDay}
          disabled={minDay ? (d) => d.getTime() < minDay.getTime() : undefined}
        />
        <div className="mt-2 flex items-center gap-2 border-t border-line pt-3">
          <Clock className="size-4 shrink-0 text-graphite" aria-hidden />
          <label htmlFor={id ? `${id}-time` : undefined} className="text-xs font-medium text-graphite">
            {t('time')}
          </label>
          <Input
            id={id ? `${id}-time` : undefined}
            type="time"
            value={timeValue}
            onChange={(e) => changeTime(e.target.value)}
            className="ml-auto h-8 w-28 text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
