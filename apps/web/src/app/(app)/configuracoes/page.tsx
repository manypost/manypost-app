import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/page-header';
import { SettingsView } from '@/features/settings/settings-view';

export const metadata: Metadata = { title: 'Configurações' };

export default async function ConfiguracoesPage() {
  const t = await getTranslations('settings');
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <SettingsView />
    </>
  );
}
