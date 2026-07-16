import type { Metadata } from 'next';
import { KanbanView } from '@/features/kanban/kanban-view';

export const metadata: Metadata = { title: 'Kanban' };

export default function KanbanPage() {
  return <KanbanView />;
}
