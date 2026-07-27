'use client';

import { Lightbulb } from 'lucide-react';
import Link from 'next/link';
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
}: {
  channelIds: string[];
  /** rascunhos por canal — o composer aplica como override de texto */
  onDrafts: (drafts: AiVariant[]) => void;
}) {
  const ai = useAiAvailability();
  const gerar = useDraftMultichannel();
  const [open, setOpen] = React.useState(false);
  const [idea, setIdea] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);

  if (!ai.enabled) return null;

  const travado = !ai.hasDraft;
  const semCanal = channelIds.length === 0;

  const enviar = async () => {
    setErro(null);
    try {
      const drafts = await gerar.mutateAsync({ idea, channelIds });
      onDrafts(drafts);
      setOpen(false);
      setIdea('');
    } catch (e) {
      setErro((e as { detail?: string }).detail ?? 'Não foi possível gerar agora.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer gap-1.5">
          <Lightbulb className="size-3.5" aria-hidden />
          Rascunho por IA
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rascunho multicanal</DialogTitle>
          <DialogDescription>
            Descreva a ideia. A IA escreve um texto adaptado para cada canal selecionado — você
            revisa antes de agendar.
          </DialogDescription>
        </DialogHeader>

        {travado ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-graphite">Este recurso faz parte do plano Premium.</p>
            <Button asChild className="w-full cursor-pointer">
              <Link href="/planos">Ver planos</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ai-idea">Sua ideia</Label>
              <Textarea
                id="ai-idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={4}
                placeholder="Ex.: agora abrimos aos domingos, das 9h às 14h, com café da manhã"
              />
              {semCanal ? (
                <p className="text-[11px] text-graphite">
                  Escolha ao menos um canal para a IA saber o limite e o formato de cada rede.
                </p>
              ) : null}
              {erro ? (
                <p role="alert" className="text-[11px] text-destructive">
                  {erro}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="cursor-pointer"
                disabled={semCanal || idea.trim().length === 0 || ai.exhausted}
                isLoading={gerar.isPending}
                onClick={() => void enviar()}
              >
                Gerar rascunhos
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
