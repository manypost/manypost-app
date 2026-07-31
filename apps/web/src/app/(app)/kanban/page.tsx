import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { KanbanView } from '@/features/kanban/kanban-view';

export const metadata: Metadata = { title: 'Kanban' };

/**
 * O quadro guarda os filtros na URL (`useSearchParams`), e por isso precisa de uma fronteira de
 * Suspense: sem ela o Next não consegue pré-renderizar a rota estaticamente e falha o build.
 */
export default function KanbanPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <KanbanView />
    </Suspense>
  );
}
