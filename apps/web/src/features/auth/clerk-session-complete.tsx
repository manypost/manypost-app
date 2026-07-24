'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  exchangeClerkSession,
  exchangeFailureAction,
  sessionTaskPath,
} from './auth-flow';

export function ClerkSessionComplete({ destination }: { destination: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { session } = useSession();
  const [retry, setRetry] = useState(0);
  const [providerUnavailable, setProviderUnavailable] = useState(false);

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

    let active = true;
    exchangeClerkSession({ getToken })
      .then(({ isNewUser }) => {
        if (!active) return;
        queryClient.clear();
        router.replace(isNewUser ? '/boas-vindas' : destination);
        router.refresh();
      })
      .catch(async (error) => {
        if (!active) return;
        if (exchangeFailureAction(error) === 'retry') {
          setProviderUnavailable(true);
          return;
        }
        await signOut();
        router.replace('/login?erro=clerk');
      });
    return () => {
      active = false;
    };
  }, [
    destination,
    getToken,
    isLoaded,
    isSignedIn,
    queryClient,
    retry,
    router,
    session,
    signOut,
  ]);

  if (providerUnavailable) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-graphite">{t('providerUnavailable')}</p>
        <Button
          type="button"
          onClick={() => {
            setProviderUnavailable(false);
            setRetry((value) => value + 1);
          }}
        >
          {t('retryCta')}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
      <p className="text-sm text-graphite">{t('finishingSession')}</p>
    </div>
  );
}
