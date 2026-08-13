'use client';

import { PenSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { KanbanBoard } from './kanban-board';

/**
 * Envolve o quadro com o cabeçalho da tela (design.md §13). Existe porque o quadro tem várias
 * saídas (carregando, erro, vazio, vazio-por-filtro e o quadro em si) e o cabeçalho pertence à
 * TELA, não a cada estado dela — repetir em cinco lugares convidaria a divergirem.
 */
export function KanbanView() {
  const t = useTranslations('kanban');
  const openComposer = useComposerModal((state) => state.openComposer);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('pageDescription')}
        actions={
          <Button className="cursor-pointer gap-2 text-paper" onClick={() => openComposer()}>
            <PenSquare className="size-4" aria-hidden />
            {t('newPost')}
          </Button>
        }
      />
      <KanbanBoard />
    </div>
  );
}
