import { getTranslations } from 'next-intl/server';
import { Wordmark } from '@/components/brand/wordmark';
import { BrandStage } from '@/features/auth/brand-stage';
import { AUTH_NETWORKS } from '@/features/auth/networks';
import { GithubIcon } from '@/features/auth/social-icons';
import { ProviderIcon } from '@/features/channels/provider-icon';

/**
 * Superfície pública de auth (SSR real — SPEC_FRONTEND §1). Split: à esquerda o
 * formulário num card sobre o canvas (profundidade por relevo de gradiente, sem
 * sombra — BRAND §2.2); à direita o palco da marca no "momento dark".
 *
 * A coluna do formulário tem uma medida única (`max-w-[25rem]`) que a marca, o
 * card e o rodapé compartilham — antes o wordmark flutuava solto no canto
 * enquanto o card ficava centralizado, sem relação entre os dois.
 *
 * Abaixo de `lg` o palco não aparece; então o resumo da proposta e o rodapé de
 * projeto aberto entram na própria coluna, senão quem abre no celular nunca vê
 * nem uma coisa nem outra.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(22rem,36fr)_64fr]">
      <div className="flex flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col gap-8">
          <Wordmark />

          <div className="flex flex-1 flex-col justify-center gap-6">
            {/* resumo da marca só quando o palco não está visível */}
            <div className="flex flex-col items-center gap-3 text-center lg:hidden">
              <p className="text-compact leading-relaxed text-graphite">{t('mobileTagline')}</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {AUTH_NETWORKS.map((n) => (
                  <ProviderIcon key={n.id} provider={n.id} name={n.name} className="size-7" />
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-lg border p-6 sm:p-8">{children}</div>

            {/* rodapé de projeto aberto — no desktop ele vive no palco escuro */}
            <p className="flex items-center justify-center gap-2 text-meta text-mist lg:hidden">
              <a
                href="https://github.com/manypost/manypost"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 font-semibold text-graphite outline-none transition-colors duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <GithubIcon className="size-4" />
                {t('proofOpen')}
              </a>
              <span aria-hidden>·</span>
              {t('madeIn')}
            </p>
          </div>
        </div>
      </div>

      <aside className="hidden lg:flex">
        <BrandStage />
      </aside>
    </div>
  );
}
