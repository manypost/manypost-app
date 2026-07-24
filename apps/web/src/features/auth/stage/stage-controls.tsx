'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Um único agrupamento de controles. Antes a paginação ficava na ponta
 * esquerda e as setas na ponta direita de um painel de ~1100px — dois
 * fragmentos sem relação. Aqui eles andam juntos, e a pastilha ativa carrega
 * o progresso do autoplay: o avanço automático passa a ser anunciado pela
 * interface em vez de surpreender quem lê.
 */
export function StageControls({
  count,
  index,
  cycle,
  autoplay,
  durationMs,
  onGoTo,
}: {
  count: number;
  index: number;
  cycle: number;
  autoplay: boolean;
  durationMs: number;
  onGoTo: (next: number) => void;
}) {
  const t = useTranslations('auth');

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2" role="group" aria-label={t('carouselLabel')}>
        {Array.from({ length: count }).map((_, i) => {
          const current = i === index;
          return (
            <button
              key={i}
              type="button"
              aria-label={t('carouselGoTo', { n: i + 1 })}
              aria-current={current || undefined}
              onClick={() => onGoTo(i)}
              className="group cursor-pointer py-2 outline-none"
            >
              <span
                className={cn(
                  'relative block h-1.5 overflow-hidden rounded-sm transition-all duration-200',
                  'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent-on-dark',
                  current ? 'w-8 bg-paper/25' : 'w-1.5 bg-paper/25 group-hover:bg-paper/45',
                )}
              >
                {current ? (
                  autoplay ? (
                    /* remonta a cada avanço (key=cycle) para reiniciar a barra */
                    <span
                      key={cycle}
                      className="auth-dot-progress absolute inset-y-0 left-0 block w-full bg-accent-on-dark"
                      style={{ animationDuration: `${durationMs}ms` }}
                    />
                  ) : (
                    /* pausado por hover/foco, ou movimento reduzido: sem
                       cronômetro correndo, a pastilha só marca a seleção */
                    <span className="absolute inset-0 block bg-accent-on-dark" />
                  )
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <span className="h-4 w-px bg-paper/15" aria-hidden />

      <div className="flex items-center gap-1.5">
        <StageArrow label={t('carouselPrev')} onClick={() => onGoTo(index - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
        </StageArrow>
        <StageArrow label={t('carouselNext')} onClick={() => onGoTo(index + 1)}>
          <ChevronRight className="size-4" aria-hidden />
        </StageArrow>
      </div>
    </div>
  );
}

function StageArrow({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 cursor-pointer place-items-center rounded-md border border-paper/15 text-paper/70 outline-none transition-colors duration-200 hover:border-paper/40 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-on-dark"
    >
      {children}
    </button>
  );
}
