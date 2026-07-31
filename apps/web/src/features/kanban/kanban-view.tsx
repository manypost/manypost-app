'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { KanbanBoard } from './kanban-board';

/**
 * Envolve o quadro com o cabeçalho da tela (design.md §13). Existe porque o quadro tem várias
 * saídas (carregando, erro, vazio, vazio-por-filtro e o quadro em si) e o cabeçalho pertence à
 * TELA, não a cada estado dela — repetir em cinco lugares convidaria a divergirem.
 */
export function KanbanView() {
  const t = useTranslations('kanban');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} description={t('pageDescription')} />
      <KanbanBoard />
    </div>
  );
}
