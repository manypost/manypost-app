'use client';

import { Clock } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAiAvailability, useBestTimes, type BestTimeSlot } from './hooks';

/**
 * Sugestão de horário ao lado do campo de agendamento (`ai_best_time`, plano Pro).
 *
 * Duas honestidades que o componente NÃO esconde:
 *  - a confiança da resposta aparece junto da lista, com o tamanho da amostra;
 *  - quando não há histórico, o rótulo diz que é ponto de partida, não medição.
 *
 * Não depende de `AI_PROVIDER`: é heurística, então aparece mesmo numa instalação sem IA.
 */

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const CONFIANCA: Record<'low' | 'medium' | 'high', string> = {
  low: 'pouco histórico ainda',
  medium: 'baseado no seu histórico',
  high: 'baseado no seu histórico',
};

/** próximo instante local que cai no dia da semana e hora do slot */
export function nextOccurrence(slot: BestTimeSlot, from = new Date()): Date {
  const alvo = new Date(from);
  alvo.setSeconds(0, 0);
  alvo.setHours(slot.hour, 0);
  const delta = (slot.weekday - alvo.getDay() + 7) % 7;
  alvo.setDate(alvo.getDate() + delta);
  // já passou hoje? vai para a semana que vem
  if (alvo.getTime() <= from.getTime()) alvo.setDate(alvo.getDate() + 7);
  return alvo;
}

/** Date → valor de `<input type="datetime-local">`, no fuso do navegador */
const toLocalInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function BestTimeHint({
  channelId,
  onPick,
}: {
  /** primeiro canal selecionado — a sugestão é por rede */
  channelId: string | undefined;
  onPick: (localValue: string) => void;
}) {
  const ai = useAiAvailability();
  const [open, setOpen] = React.useState(false);
  const consulta = useBestTimes(channelId, open && ai.hasBestTime);

  if (!channelId) return null;

  const travado = !ai.hasBestTime;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Sugerir melhor horário"
              className="cursor-pointer text-graphite transition-colors duration-200 hover:border-ink hover:text-ink"
            >
              <Clock className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="text-xs font-semibold">
          Sugerir melhor horário
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Melhores horários</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {travado ? (
          <div className="px-2 py-2">
            <p className="text-xs text-graphite">Recurso do plano Pro.</p>
            <Button asChild size="sm" className="mt-2 w-full cursor-pointer">
              <Link href="/planos">Ver planos</Link>
            </Button>
          </div>
        ) : consulta.isPending ? (
          <p className="px-2 py-2 text-xs text-graphite">Calculando…</p>
        ) : consulta.isError || !consulta.data ? (
          <p className="px-2 py-2 text-xs text-graphite">Não foi possível calcular agora.</p>
        ) : (
          <>
            {consulta.data.slots.map((slot) => {
              const quando = nextOccurrence(slot);
              return (
                <DropdownMenuItem
                  key={`${slot.weekday}-${slot.hour}`}
                  className="cursor-pointer justify-between gap-3"
                  onSelect={() => onPick(toLocalInput(quando))}
                >
                  <span className="text-sm">
                    {DIAS[slot.weekday]}, {String(slot.hour).padStart(2, '0')}:00
                  </span>
                  <span className="text-[11px] text-graphite">
                    {quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <p className="px-2 pb-1.5 text-[11px] leading-relaxed text-graphite">
              {consulta.data.fromBaseline
                ? 'Ponto de partida para esta rede — ainda não há histórico seu neste canal.'
                : `${CONFIANCA[consulta.data.confidence]} (${consulta.data.sampleSize} publicações).`}
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
