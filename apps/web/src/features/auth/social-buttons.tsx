'use client';

import { useSignIn, useSignUp } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { startGoogleSso } from './auth-flow';
import { SOCIAL_ICONS } from './social-icons';

export function SocialButtons({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <ClerkSocialButtons mode={mode} />;
}

function ClerkSocialButtons({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const t = useTranslations('auth');
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const Google = SOCIAL_ICONS.google;
  const resource = mode === 'sign-in' ? signIn : signUp;
  const fetching = signInStatus === 'fetching' || signUpStatus === 'fetching';
  const ready = Boolean(resource);
  const loading = fetching || starting;

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        isLoading={loading}
        disabled={!ready || loading}
        onClick={async () => {
          setError(null);
          setStarting(true);
          try {
            const result = await startGoogleSso({ resource, mode });
            if (result === 'unavailable') setError(t('googleUnavailable'));
          } finally {
            setStarting(false);
          }
        }}
      >
        {Google ? <Google /> : null}
        {t('continueGoogle')}
      </Button>
      {error ? (
        <p className="text-compact text-state-failed" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-meta text-graphite">{t('socialDividerEmail')}</span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}
