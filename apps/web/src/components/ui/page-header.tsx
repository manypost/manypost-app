import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Cabeçalho de página (design.md §13).
 *
 * Nenhuma tela do app tinha um: o título vivia só na topbar, então nenhuma tela **dizia o que
 * era**. A descrição não é enfeite — é a linha que responde "para que serve esta tela" para quem
 * chegou aqui pela primeira vez, e o §36.4 pede exatamente isso ("empty states descrevem o
 * próximo passo"; a mesma lógica vale para a tela cheia).
 *
 * Regras do §13 implementadas aqui:
 *  - título 20px/500, alinhado à esquerda, **sem** ponto final;
 *  - descrição na medida única de leitura, em texto secundário;
 *  - ações à direita no desktop e **abaixo** no mobile — nunca encolhendo o título (§37).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
}: {
  title: string;
  description?: string;
  /** ação primária da tela; no mobile desce para a própria linha */
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            'font-display text-title font-semibold leading-tight tracking-[-0.025em] text-ink',
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-reading text-compact leading-relaxed text-graphite">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );
}
