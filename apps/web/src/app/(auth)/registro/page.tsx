import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { RegisterForm } from '@/features/auth/register-form';
import { SocialButtons } from '@/features/auth/social-buttons';

export const metadata: Metadata = { title: 'Criar conta' };

export default async function RegistroPage() {
  const t = await getTranslations('auth');
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-accent">
          {t('registerKicker')}
        </p>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.5px] text-ink">
          {t('registerTitle')}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-graphite">{t('registerSubtitle')}</p>
      </header>
      <SocialButtons />
      <RegisterForm />
      <p className="text-center text-[13px] text-graphite">
        {t('hasAccount')}{' '}
        <Link
          href="/login"
          className="font-semibold text-accent transition-colors duration-200 hover:text-accent-hover"
        >
          {t('goLogin')}
        </Link>
      </p>
    </div>
  );
}
