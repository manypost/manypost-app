import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { PublicationsList } from '@/features/publications/publications-list';

export const metadata: Metadata = { title: 'Calendário' };

export default async function CalendarioPage() {
  const t = await getTranslations('calendar');
  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')}>
        <Button asChild>
          <Link href="/compor">{t('newPost')}</Link>
        </Button>
      </PageHeader>
      <PublicationsList />
    </>
  );
}
