'use client';

import { WandSparkles } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAiAvailability, useGenerateAltText } from './hooks';

/**
 * Gera a descrição de uma imagem para leitor de tela (SPEC_AI §3).
 *
 * Some em três situações, todas legítimas: instalação sem IA, modelo que não enxerga imagem
 * (`canDescribeImages`) e mídia que não é imagem. Descrever um vídeo ou chutar pelo nome do
 * arquivo seria pior para quem depende do alt do que não oferecer o botão.
 *
 * O texto gerado vai para o campo, não para o banco: quem salva é a pessoa.
 *
 * Por que `Tooltip` e não `title`: um botão `disabled` não recebe foco e o `title` nativo não é
 * anunciado de forma confiável — a explicação existia no DOM e não chegava a quem precisava dela.
 * Num controle cuja razão de existir é acessibilidade, isso não passa.
 */
export function AltTextButton({
  mediaId,
  mime,
  onGenerated,
}: {
  mediaId: string;
  mime: string;
  onGenerated: (alt: string) => void;
}) {
  const t = useTranslations('ai');
  const ai = useAiAvailability();
  const gerar = useGenerateAltText();
  const [erro, setErro] = React.useState<string | null>(null);

  if (!ai.enabled || !ai.canDescribeImages || !mime.startsWith('image/')) return null;

  const semPlano = !ai.hasCaption;
  const travado = semPlano || ai.exhausted;
  const motivo = semPlano ? t('lockedPro') : ai.exhausted ? t('exhausted') : null;

  const botao = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-fit cursor-pointer gap-1.5"
      disabled={travado}
      isLoading={gerar.isPending}
      onClick={async () => {
        setErro(null);
        try {
          onGenerated(await gerar.mutateAsync({ mediaId }));
        } catch (e) {
          setErro((e as { detail?: string }).detail ?? t('describeError'));
        }
      }}
    >
      {gerar.isPending ? null : <WandSparkles className="size-3.5" aria-hidden />}
      {t('describeImage')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div aria-live="polite" className="sr-only">
        {gerar.isPending ? t('workingAnnounce') : null}
      </div>

      {travado ? (
        // `span` embrulhando: botão desabilitado não dispara os eventos que o tooltip escuta
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-fit">{botao}</span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-meta font-semibold">
            {motivo}
          </TooltipContent>
        </Tooltip>
      ) : (
        botao
      )}

      {/* travado por PLANO tem caminho de saída — esconder o upgrade não converte ninguém */}
      {semPlano ? (
        <Link
          href="/planos"
          className="w-fit cursor-pointer text-meta font-semibold text-accent underline-offset-2 outline-none transition-colors duration-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('seePlans')}
        </Link>
      ) : null}

      {erro ? (
        <p role="alert" className="text-meta text-state-failed">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
