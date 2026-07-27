'use client';

import { WandSparkles } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useAiAvailability, useGenerateAltText } from './hooks';

/**
 * Gera a descrição de uma imagem para leitor de tela (SPEC_AI §3).
 *
 * Some em três situações, todas legítimas: instalação sem IA, modelo que não enxerga imagem
 * (`canDescribeImages`) e mídia que não é imagem. Descrever um vídeo ou chutar pelo nome do
 * arquivo seria pior para quem depende do alt do que não oferecer o botão.
 *
 * O texto gerado vai para o campo, não para o banco: quem salva é a pessoa.
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
  const ai = useAiAvailability();
  const gerar = useGenerateAltText();
  const [erro, setErro] = React.useState<string | null>(null);

  if (!ai.enabled || !ai.canDescribeImages || !mime.startsWith('image/')) return null;

  const travado = !ai.hasCaption || ai.exhausted;

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit cursor-pointer gap-1.5"
        disabled={travado}
        isLoading={gerar.isPending}
        title={
          travado
            ? ai.exhausted
              ? 'Franquia de IA esgotada neste mês'
              : 'Recurso do plano Pro'
            : undefined
        }
        onClick={async () => {
          setErro(null);
          try {
            onGenerated(await gerar.mutateAsync({ mediaId }));
          } catch (e) {
            setErro((e as { detail?: string }).detail ?? 'Não foi possível descrever agora.');
          }
        }}
      >
        <WandSparkles className="size-3.5" aria-hidden />
        Descrever com IA
      </Button>
      {erro ? (
        <p role="alert" className="text-[11px] text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
