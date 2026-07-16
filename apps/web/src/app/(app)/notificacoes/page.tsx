import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shell/page-header';
import { NotificationsView } from '@/features/notifications/notifications-view';

export const metadata: Metadata = { title: 'Notificações' };

export default async function NotificacoesPage() {
  const t = await getTranslations('notifications');
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <NotificationsView />
    </>
  );
}
