import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/brand/wordmark';
import { BrandStage } from '@/features/auth/brand-stage';
import { AUTH_NETWORKS } from '@/features/auth/networks';
import { ProviderIcon } from '@/features/channels/provider-icon';

/**
 * Superfície pública de auth (SSR real — SPEC_FRONTEND §1). Split: à esquerda o
 * formulário num card sobre o canvas (profundidade por borda + camada, sem
 * sombra — BRAND §2.2); à direita o palco da marca no "momento dark". No mobile
 * o palco some, então um resumo compacto da proposta aparece sobre o card.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');
  return (
    <div className="grid min-h-dvh lg:grid-cols-[35fr_65fr]">
      <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
        <Wordmark />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            {/* resumo da marca só no mobile (o palco escuro não aparece) */}
            <div className="mb-7 flex flex-col items-center gap-3 text-center lg:hidden">
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
      <aside className="hidden lg:flex">
        <BrandStage />
      </aside>
    </div>
  );
}
