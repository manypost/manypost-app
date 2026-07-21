import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlansView } from '@/features/billing/plans-view';

export const metadata: Metadata = { title: 'Planos' };

export default function PlanosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <PlansView />
    </Suspense>
  );
}
