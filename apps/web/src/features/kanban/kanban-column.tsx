'use client';

import { useDroppable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ColumnId } from './logic';

/** Coluna do quadro: alvo de soltura e cabeçalho com a contagem do que foi LIDO. */
export function KanbanColumn({
  id,
  accent,
  title,
  count,
  compacta,
  children,
}: {
  id: ColumnId;
  accent: string;
  title: string;
  count: number;
  compacta: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        'flex min-h-64 w-60 shrink-0 flex-col border-l border-line transition-colors duration-200 first:border-l-0 lg:w-auto lg:min-w-0 lg:flex-1',
        compacta ? 'gap-2 px-2' : 'gap-3 px-3',
        isOver && 'bg-accent-tint',
      )}
    >
      <h2 className="sticky top-[59px] z-10 flex min-h-11 items-center justify-between border-b border-line bg-surface px-1 text-panel font-medium text-ink">
        <span className="flex items-center gap-2">
          <span className={cn('size-1.5 shrink-0 rounded-full', accent)} aria-hidden />
          {title}
        </span>
        <span className="rounded-key bg-surface-2 px-1.5 py-0.5 text-meta tabular-nums text-graphite">{count}</span>
      </h2>
      {children}
    </section>
  );
}

/**
 * Alvo de cancelamento — existe SÓ durante o arraste.
 *
 * Não é uma sexta coluna de propósito (design.md): uma coluna "Cancelado" seria lugar de descanso,
 * acumularia e sugeriria que trabalho cancelado faz parte do pipeline. Não faz — é trabalho que
 * saiu. Como faixa efêmera, ela aparece quando é útil e some quando não é.
 */
export function CancelDropZone({ ativo }: { ativo: boolean }) {
  const t = useTranslations('kanban');
  const { setNodeRef, isOver } = useDroppable({ id: 'col-cancel' });
  if (!ativo) return null;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center justify-center gap-2 rounded-card border border-dashed py-3 text-compact font-semibold transition-colors duration-200',
        isOver
          ? 'border-state-failed bg-state-failed/10 text-state-failed'
          : 'border-line text-graphite',
      )}
    >
      <Trash2 className="size-4" aria-hidden />
      {t('dropToCancel')}
    </div>
  );
}
