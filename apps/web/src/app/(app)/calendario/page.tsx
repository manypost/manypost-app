import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarView } from '@/features/calendar/calendar-view';

export const metadata: Metadata = { title: 'Calendário' };

export default function CalendarioPage() {
  return (
    // useSearchParams (filtros na URL) exige boundary de Suspense
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <CalendarView />
    </Suspense>
  );
}
