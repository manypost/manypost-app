import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { PlansView } from '@/features/billing/plans-view';

export const metadata: Metadata = { title: 'Planos' };

export default async function PlanosPage() {
  const t = await getTranslations('billing');
  return (
    <>
      <PageHeader title={t('title')} description={t('subheadline')} />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <PlansView />
      </Suspense>
    </>
  );
}
