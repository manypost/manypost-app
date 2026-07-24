'use client';

import { useTranslations } from 'next-intl';
import { ProviderIcon } from '@/features/channels/provider-icon';
import { AUTH_NETWORKS } from '../../networks';
import { SlideFrame } from '../slide-frame';

/**
 * Slide 2 — a semana: prova de "agende uma vez, publique na hora certa".
 * As colunas entram escalonadas (dia a dia) e respondem ao ponteiro com
 * borda de acento — o hover de card do brand (BRAND §7.A), sem deslocamento.
 */

const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const SCHEDULED: Record<number, { time: string; network: (typeof AUTH_NETWORKS)[number] }> = {
  1: { time: '09:00', network: AUTH_NETWORKS[0] },
  3: { time: '13:30', network: AUTH_NETWORKS[2] },
  5: { time: '18:00', network: AUTH_NETWORKS[3] },
};

export function ScheduleSlide() {
  const t = useTranslations('auth');

  return (
    <SlideFrame
      kicker={t('slideScheduleKicker')}
      lines={[t('slideScheduleTitle1'), t('slideScheduleTitle2')]}
      sub={t('slideScheduleSub')}
    >
      <div
        className="flex h-full flex-col rounded-lg border border-paper/10 bg-paper/[0.03] p-5"
        role="img"
        aria-label={t('slideScheduleSub')}
      >
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-paper/50">
          {t('slideWeekLabel')}
        </p>
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-2.5">
          {WEEK.map((day, i) => {
            const slot = SCHEDULED[i];
            return (
              <div
                key={day}
                className="auth-enter auth-cell flex min-w-0 flex-col gap-2.5 rounded-md border border-paper/10 bg-paper/[0.02] p-2.5 transition-colors duration-200 hover:border-accent-on-dark/35 hover:bg-paper/[0.05]"
                style={{ '--i': i } as React.CSSProperties}
              >
                <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-paper/45">
                  {day}
                </span>
                {slot ? (
                  <div className="flex flex-col gap-2 rounded-md border border-paper/10 bg-paper/[0.07] p-2">
                    <div className="flex items-center gap-1.5">
                      <ProviderIcon
                        provider={slot.network.id}
                        name={slot.network.name}
                        className="size-5"
                      />
                      <span className="truncate text-[10px] font-semibold tabular-nums text-accent-on-dark">
                        {slot.time}
                      </span>
                    </div>
                    <span className="h-1.5 w-full rounded-sm bg-paper/15" aria-hidden />
                    <span className="h-1.5 w-3/5 rounded-sm bg-paper/15" aria-hidden />
                  </div>
                ) : (
                  /* horário livre: uma pauta fantasma. Sem isso a célula vazia
                     lia como conteúdo faltando, não como "nada agendado". */
                  <span className="h-1.5 w-full rounded-sm bg-paper/[0.07]" aria-hidden />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SlideFrame>
  );
}
