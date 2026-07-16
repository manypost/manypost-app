import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PagePlaceholder } from '@/components/shell/page-placeholder';

export const metadata: Metadata = { title: 'Calendário' };

export default async function CalendarioPage() {
  const t = await getTranslations();
  return <PagePlaceholder title={t('nav.calendar')} description={t('placeholders.calendar')} />;
}
