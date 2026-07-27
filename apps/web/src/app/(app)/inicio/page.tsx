import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HomeView } from '@/features/home/home-view';

export const metadata: Metadata = { title: 'Início' };

export default function InicioPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <HomeView />
    </Suspense>
  );
}
