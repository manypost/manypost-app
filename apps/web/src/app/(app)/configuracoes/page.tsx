import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PagePlaceholder } from '@/components/shell/page-placeholder';

export const metadata: Metadata = { title: 'Configurações' };

export default async function ConfiguracoesPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t('nav.settings')} description={t('placeholders.settings')} />;
}
