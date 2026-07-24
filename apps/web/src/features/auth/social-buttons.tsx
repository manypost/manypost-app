'use client';

import { useSignIn, useSignUp } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { clerkSsoRequest } from './auth-flow';
import { SOCIAL_ICONS } from './social-icons';

export function SocialButtons({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <ClerkSocialButtons mode={mode} />;
}

function ClerkSocialButtons({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const t = useTranslations('auth');
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const [error, setError] = useState<string | null>(null);
  const Google = SOCIAL_ICONS.google;
  const loading = signInStatus === 'fetching' || signUpStatus === 'fetching';

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        isLoading={loading}
        onClick={async () => {
          setError(null);
          const resource = mode === 'sign-in' ? signIn : signUp;
          const { mode: _mode, ...request } = clerkSsoRequest(mode);
          const { error: clerkError } = await resource.sso(request);
          if (clerkError) setError(t('googleUnavailable'));
        }}
      >
        {Google ? <Google /> : null}
        {t('continueGoogle')}
      </Button>
      {error ? (
        <p className="text-sm text-state-failed" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-graphite">{t('socialDividerEmail')}</span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}
