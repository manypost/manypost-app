'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionTaskPath } from './auth-flow';

export function ClerkSessionComplete({ destination }: { destination: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useAuth();
  const { session } = useSession();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace('/login');
      return;
    }
    const taskPath = sessionTaskPath(session?.currentTask?.key);
    if (taskPath) {
      router.replace(taskPath);
      return;
    }

    queryClient.clear();
    router.replace(destination);
    router.refresh();
  }, [
    destination,
    isLoaded,
    isSignedIn,
    queryClient,
    router,
    session,
  ]);

  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
      <p className="text-sm text-graphite">{t('finishingSession')}</p>
    </div>
  );
}
