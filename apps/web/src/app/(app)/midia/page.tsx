import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PagePlaceholder } from '@/components/shell/page-placeholder';

export const metadata: Metadata = { title: 'Mídia' };

export default async function MidiaPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t('nav.media')} description={t('placeholders.media')} />;
}
