import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PagePlaceholder } from '@/components/shell/page-placeholder';

export const metadata: Metadata = { title: 'Notificações' };

export default async function NotificacoesPage() {
  const t = await getTranslations();
  return (
    <PagePlaceholder title={t('nav.notifications')} description={t('placeholders.notifications')} />
  );
}
