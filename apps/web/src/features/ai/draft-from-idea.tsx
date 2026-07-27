'use client';

import { CircleAlert, Lightbulb } from 'lucide-react';
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
import { useAiAvailability, useDraftMultichannel, type AiVariant } from './hooks';

/**
 * "IA: rascunho multicanal a partir de uma ideia" (plano Premium).
 *
 * Devolve um texto por canal e os entrega ao composer como **override por canal** — que é
 * exatamente a forma que a API de agendamento já aceita (`textByChannel`). Nada é agendado
 * aqui: o composer abre preenchido e a pessoa revisa.
 */
export function DraftFromIdea({
  channelIds,
  onDrafts,
  networkNameOf,
}: {
  channelIds: string[];
  /** rascunhos por canal — o composer aplica como override de texto */
  onDrafts: (drafts: AiVariant[]) => void;
  /** rótulo humano da rede, para o aviso citar "Instagram" em vez de um uuid */
  networkNameOf?: (channelId: string) => string;
}) {
  const t = useTranslations('ai');
  const tc = useTranslations('common');
  const ai = useAiAvailability();
  const gerar = useDraftMultichannel();
  const [open, setOpen] = React.useState(false);
  const [idea, setIdea] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  /** redes cujo texto precisou ser cortado para caber — null = nada a avisar */
  const [encurtados, setEncurtados] = React.useState<string[] | null>(null);

  if (!ai.enabled) return null;

  const travado = !ai.hasDraft;
  const semCanal = channelIds.length === 0;

  /**
   * Aplica sempre — aqui a saída é texto NOVO, então cortar para caber é legítimo (diferente da
   * reescrita, cuja entrada é o texto da pessoa). O que não é legítimo é aplicar em silêncio: se
   * algum canal foi encurtado, o diálogo fica aberto dizendo QUAIS, e a pessoa fecha sabendo o
   * que foi para cada aba. Sem isso, `shortened` voltava da API e morria aqui.
   */
  const enviar = async () => {
    setErro(null);
    try {
      const drafts = await gerar.mutateAsync({ idea, channelIds });
      onDrafts(drafts);

      const cortados = drafts.filter((d) => d.shortened).map((d) => networkNameOf?.(d.channelId) ?? d.channelId);
      if (cortados.length > 0) {
        setEncurtados(cortados);
        return; // o diálogo continua aberto para o aviso ser lido
      }
      setOpen(false);
      setIdea('');
    } catch (e) {
      setErro((e as { detail?: string }).detail ?? t('genericError'));
    }
  };

  const concluir = () => {
    setEncurtados(null);
    setOpen(false);
    setIdea('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer gap-1.5">
          <Lightbulb className="size-3.5" aria-hidden />
          {t('draftTrigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('draftTitle')}</DialogTitle>
          <DialogDescription>{t('draftDescription')}</DialogDescription>
        </DialogHeader>

        {travado ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-graphite">{t('lockedPremium')}</p>
            <Button asChild className="w-full cursor-pointer">
              <Link href="/planos">{t('seePlans')}</Link>
            </Button>
          </div>
        ) : encurtados ? (
          // aplicado, mas com corte: a pessoa fecha sabendo o que foi para cada aba
          <div className="flex flex-col gap-3">
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-graphite" aria-hidden />
              <p className="text-[13px] leading-relaxed text-graphite">
                {t('draftShortened', { count: encurtados.length, networks: encurtados.join(', ') })}
              </p>
            </div>
            <Button className="w-full cursor-pointer" onClick={concluir}>
              {t('draftReview')}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-idea">{t('draftFieldLabel')}</Label>
              <Textarea
                id="ai-idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={4}
                placeholder={t('draftPlaceholder')}
              />
              {semCanal ? <p className="text-meta text-graphite">{t('needChannel')}</p> : null}
              {ai.exhausted ? <p className="text-meta text-graphite">{t('exhausted')}.</p> : null}
              {erro ? (
                <p role="alert" className="text-meta text-state-failed">
                  {erro}
                </p>
              ) : null}
              <div aria-live="polite" className="sr-only">
                {gerar.isPending ? t('workingAnnounce') : null}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button
                className="cursor-pointer"
                disabled={semCanal || idea.trim().length === 0 || ai.exhausted}
                isLoading={gerar.isPending}
                onClick={() => void enviar()}
              >
                {t('draftSubmit')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
