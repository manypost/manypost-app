import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { OnboardingView } from '@/features/billing/onboarding-view';

export const metadata: Metadata = { title: 'Bem-vindo' };

export default function BoasVindasPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-96 rounded-lg" />}>
      <OnboardingView />
    </Suspense>
  );
}
