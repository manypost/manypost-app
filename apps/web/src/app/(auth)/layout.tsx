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
<<<<<<< Updated upstream
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
=======
    <div className="grid min-h-dvh xl:grid-cols-[45fr_55fr]">
      <div className="flex flex-col gap-8 px-6 py-8 xl:px-10 xl:py-10">
        <Wordmark />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            {/* resumo da marca só no mobile (o palco escuro não aparece) */}
            <div className="mb-7 flex flex-col items-center gap-3 text-center xl:hidden">
              <p className="text-[13px] leading-relaxed text-graphite">{t('mobileTagline')}</p>
              <div className="flex gap-1.5">
                {AUTH_NETWORKS.map((n) => (
                  <ProviderIcon
                    key={n.id}
                    provider={n.id}
                    name={n.name}
                    className="size-7 border border-line"
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">{children}</div>
          </div>
        </div>
      </div>
      <aside className="hidden xl:flex">
        <BrandStage />
>>>>>>> Stashed changes
      </aside>
    </div>
  );
}
