import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PagePlaceholder } from '@/components/shell/page-placeholder';

export const metadata: Metadata = { title: 'Kanban' };

export default async function KanbanPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t('nav.kanban')} description={t('placeholders.kanban')} />;
}
