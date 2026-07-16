import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/shell/page-header';
import { MediaView } from '@/features/media/media-view';

export const metadata: Metadata = { title: 'Mídia' };

export default async function MidiaPage() {
  const t = await getTranslations('media');
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <MediaView />
    </>
  );
}
