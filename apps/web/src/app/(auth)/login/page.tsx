import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { LoginForm } from '@/features/auth/login-form';
import { SocialButtons } from '@/features/auth/social-buttons';

export const metadata: Metadata = { title: 'Entrar' };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const t = await getTranslations('auth');
  const sp = await searchParams;
  // só caminho interno — nunca URL absoluta (anti open-redirect)
  const de = typeof sp.de === 'string' && sp.de.startsWith('/') && !sp.de.startsWith('//') ? sp.de : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-accent">
          {t('loginKicker')}
        </p>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.5px] text-ink">
          {t('loginTitle')}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-graphite">{t('loginSubtitle')}</p>
      </header>
      <SocialButtons mode="sign-in" />
      <LoginForm nextPath={de} />
      <p className="text-center text-[13px] text-graphite">
        {t('noAccount')}{' '}
        <Link
          href="/registro"
          className="font-semibold text-accent transition-colors duration-200 hover:text-accent-hover"
        >
          {t('goRegister')}
        </Link>
      </p>
    </div>
  );
}
