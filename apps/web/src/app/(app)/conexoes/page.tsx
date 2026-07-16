import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shell/page-header';
import { ConnectionsView } from '@/features/channels/connections-view';

export const metadata: Metadata = { title: 'Conexões' };

export default async function ConexoesPage() {
  const t = await getTranslations('connections');
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <ConnectionsView />
    </>
  );
}
