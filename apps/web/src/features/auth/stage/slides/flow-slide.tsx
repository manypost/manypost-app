'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SlideFrame } from '../slide-frame';

/**
 * Slide 3 — o funil: prova de "do rascunho ao ar, com aprovação do cliente".
 * As colunas entram escalonadas, na ordem do fluxo, e o ponto de estado pulsa
 * na coluna sob o ponteiro — o trabalho andando de coluna em coluna.
 */

export function FlowSlide() {
  const t = useTranslations('auth');

  const columns = [
    { label: t('colDraft'), dot: 'bg-paper/40', cards: 2 },
    { label: t('colReview'), dot: 'bg-state-review', cards: 1 },
    { label: t('colScheduled'), dot: 'bg-accent-on-dark', cards: 2 },
    { label: t('colPublished'), dot: 'bg-state-published', cards: 1 },
  ];

  return (
    <SlideFrame
      kicker={t('slideFlowKicker')}
      lines={[t('slideFlowTitle1'), t('slideFlowTitle2')]}
      sub={t('slideFlowSub')}
    >
      <div
        className="grid h-full grid-cols-4 gap-4"
        role="img"
        aria-label={t('slideFlowSub')}
      >
        {columns.map((column, i) => (
          <div
            key={column.label}
            className="auth-enter auth-cell group flex min-w-0 flex-col gap-2.5 rounded-lg border border-paper/10 bg-paper/[0.03] p-3.5 transition-colors duration-200 hover:border-accent-on-dark/35 hover:bg-paper/[0.05]"
            style={{ '--i': i } as React.CSSProperties}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn('auth-cell-dot size-1.5 shrink-0 rounded-sm', column.dot)}
                aria-hidden
              />
              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-paper/55">
                {column.label}
              </span>
            </div>
            {Array.from({ length: column.cards }).map((_, card) => (
              <div
                key={card}
                className="flex flex-col gap-2 rounded-md border border-paper/10 bg-paper/[0.05] p-2.5 transition-colors duration-200 group-hover:border-paper/20"
              >
                <span className="h-1.5 w-full rounded-sm bg-paper/15" aria-hidden />
                <span className="h-1.5 w-3/5 rounded-sm bg-paper/15" aria-hidden />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}
