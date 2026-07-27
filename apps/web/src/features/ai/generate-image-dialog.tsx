'use client';

import { ImagePlus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ASPECTOS, useAiAvailability, useGenerateImage, type AspectId, type GeneratedMedia } from './hooks';

/**
 * "IA: gera imagem para o post" (`ai_image`, plano Premium — 5 créditos por imagem).
 *
 * Some inteiro quando a instalação não consegue desenhar (`capabilities.ai.canGenerateImages`):
 * oferecer um botão que responderia 501 é pior que não ter botão. Plano sem a feature MOSTRA o
 * controle travado com o caminho de upgrade, como o resto da superfície de IA.
 *
 * A forma é **proporção**, nunca resolução: é assim que as redes pensam, e é o que o contrato
 * aceita. Quando um canal é escolhido, a proporção certa dele já vem selecionada.
 */
export function GenerateImageDialog({
  channelId,
  onGenerated,
  trigger,
}: {
  /** canal de destino — decide a proporção sugerida */
  channelId?: string;
  /** a mídia recém-criada, para quem chamou usá-la (o composer anexa ao post) */
  onGenerated?: (media: GeneratedMedia) => void;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations('ai');
  const tc = useTranslations('common');
  const ai = useAiAvailability();
  const gerar = useGenerateImage();

  const [open, setOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState('');
  const [aspect, setAspect] = React.useState<AspectId | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [pronta, setPronta] = React.useState<GeneratedMedia | null>(null);

  // instalação sem IA, ou com um provedor que não desenha: a ação não existe
  if (!ai.enabled || !ai.canGenerateImages) return null;

  const travado = !ai.hasImage;

  const enviar = async () => {
    setErro(null);
    try {
      const media = await gerar.mutateAsync({
        prompt,
        ...(aspect ? { aspect } : {}),
        // sem proporção explícita, o canal decide — a regra vive no servidor
        ...(!aspect && channelId ? { channelId } : {}),
      });
      setPronta(media);
    } catch (e) {
      setErro((e as { detail?: string }).detail ?? t('imageError'));
    }
  };

  const fechar = () => {
    setOpen(false);
    setPronta(null);
    setPrompt('');
    setErro(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPronta(null);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="cursor-pointer gap-1.5">
            <ImagePlus className="size-3.5" aria-hidden />
            {t('imageTrigger')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('imageTitle')}</DialogTitle>
          <DialogDescription>{t('imageDescription')}</DialogDescription>
        </DialogHeader>

        {travado ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-graphite">{t('lockedPremium')}</p>
            <Button asChild className="w-full cursor-pointer">
              <Link href="/planos">{t('seePlans')}</Link>
            </Button>
          </div>
        ) : pronta ? (
          <div className="flex flex-col gap-3">
            {/* a imagem gerada, para a pessoa julgar antes de usar */}
            <img
              src={pronta.url}
              alt=""
              className="max-h-72 w-full rounded-lg border border-line object-contain"
            />
            <p role="status" className="text-compact text-graphite">
              {t('imageDone')}
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setPronta(null);
                  setErro(null);
                }}
              >
                {t('imageAnother')}
              </Button>
              <Button
                className="cursor-pointer"
                onClick={() => {
                  onGenerated?.(pronta);
                  fechar();
                }}
              >
                {onGenerated ? t('imageUseIt') : tc('close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ai-image-prompt">{t('imageFieldLabel')}</Label>
                <Textarea
                  id="ai-image-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder={t('imagePlaceholder')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-meta font-semibold uppercase tracking-wide text-graphite">
                  {t('imageAspectLabel')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECTOS.map((a) => {
                    const ativo = aspect === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => setAspect(ativo ? null : a.id)}
                        className={cn(
                          'cursor-pointer rounded-md border px-2.5 py-1 text-meta font-semibold outline-none transition-colors duration-200',
                          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                          ativo
                            ? 'bevel-accent text-ink'
                            : 'border-line bg-surface text-graphite hover:text-ink',
                        )}
                      >
                        {t(a.labelKey)}
                      </button>
                    );
                  })}
                </div>
                {channelId && !aspect ? (
                  <p className="text-meta text-graphite">{t('imageAspectHint')}</p>
                ) : null}
              </div>

              {ai.credits?.enforced ? (
                <p className="text-meta text-graphite">{t('imageCost', { count: 5 })}</p>
              ) : null}
              {ai.exhausted ? <p className="text-meta text-graphite">{t('exhausted')}.</p> : null}
              {erro ? (
                <p role="alert" className="text-meta text-state-failed">
                  {erro}
                </p>
              ) : null}
              <div aria-live="polite" className="sr-only">
                {gerar.isPending ? t('imageGenerating') : null}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="cursor-pointer" onClick={fechar}>
                {tc('cancel')}
              </Button>
              <Button
                className="cursor-pointer"
                disabled={prompt.trim().length === 0 || ai.exhausted}
                isLoading={gerar.isPending}
                onClick={() => void enviar()}
              >
                {t('imageSubmit')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
