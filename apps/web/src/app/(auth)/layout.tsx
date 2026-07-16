import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/brand/wordmark';

/**
 * Superfície pública de auth (SSR real — SPEC_FRONTEND §1). Split: formulário
 * à esquerda; à direita o "momento dark" da marca (BRAND §3 --night), com
 * texto de acento em --accent-on-dark (o --accent puro reprova AA no escuro).
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col p-6 lg:p-10">
        <Wordmark />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <aside className="hidden bg-night lg:flex lg:flex-col lg:justify-center lg:p-16">
        <p className="font-display text-[44px] font-medium leading-[1.05] tracking-[-0.5px] text-paper">
          {t('heroTitle')}
        </p>
        <p className="mt-6 text-[15px] leading-relaxed text-accent-on-dark">{t('heroSubtitle')}</p>
      </aside>
    </div>
  );
}
