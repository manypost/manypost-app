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
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.5px] text-ink">
          {t('registerTitle')}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-graphite">{t('registerSubtitle')}</p>
      </header>
      <RegisterForm />
      <SocialButtons />
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
