'use client';

import { useSignIn, useSignUp } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { clerkSsoRequest } from './auth-flow';
import { useSocialProviders } from './hooks';
import { SOCIAL_ICONS } from './social-icons';

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Login social do catálogo GET /v1/auth/social (vazio = some). Fica no topo do
 * formulário, com a logo de cada provedor e lado a lado quando há mais de um; o
 * divisor abaixo faz a ponte para o login por e-mail.
 */
export function SocialButtons({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return clerkEnabled ? <ClerkSocialButtons mode={mode} /> : <LegacySocialButtons />;
}

function LegacySocialButtons() {
  const t = useTranslations('auth');
  const { data } = useSocialProviders();
  const providers = data?.providers ?? [];
  if (!providers.length) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('grid gap-2', providers.length > 1 && 'grid-cols-2')}>
        {providers.map((p) => {
          const Icon = SOCIAL_ICONS[p.id];
          return (
            <Button key={p.id} variant="outline" asChild>
              {/* navegação plena: a API redireciona ao provedor e volta com cookies */}
              <a href={`/v1/auth/social/${p.id}`}>
                {Icon ? <Icon /> : null}
                {p.name}
              </a>
            </Button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-graphite">{t('socialDividerEmail')}</span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
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
