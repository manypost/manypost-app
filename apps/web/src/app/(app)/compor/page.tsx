import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shell/page-header';
import { ComposerView } from '@/features/composer/composer-view';

export const metadata: Metadata = { title: 'Compor' };

export default async function ComporPage() {
  const t = await getTranslations('composer');
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <ComposerView />
    </>
  );
}
