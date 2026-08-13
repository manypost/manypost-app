'use client';

import { Clock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
 * A honestidade aqui é o produto. O sinal disponível hoje é **frequência de publicação** — a
 * plataforma não coleta desempenho (`channel_metrics` está vazia) —, então a frase descreve
 * exatamente isso: "os horários que você mais usa". Dizer "baseado no seu histórico" com
 * confiança alta insinuaria medição que não existe, e é o tipo de coisa que corrói confiança
 * quando o cliente percebe. A frase sai do `signal` que a API devolve, não de um texto fixo.
 *
 * Não depende de `AI_PROVIDER`: é heurística, então aparece mesmo numa instalação sem IA.
 */

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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
  const t = useTranslations('ai');
  const ai = useAiAvailability();
  const [open, setOpen] = React.useState(false);
  const consulta = useBestTimes(channelId, open && ai.hasBestTime);

  if (!channelId) return null;

  const travado = !ai.hasBestTime;
  const dados = consulta.data;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t('bestTimeTrigger')}
              className="cursor-pointer text-graphite transition-colors duration-200 hover:text-ink"
            >
              <Clock className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="text-meta font-semibold">
          {t('bestTimeTrigger')}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t('bestTimeTitle')}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {travado ? (
          <div className="px-2 py-2">
            <p className="text-meta text-graphite">{t('lockedPro')}.</p>
            <Button asChild size="sm" className="mt-2 w-full cursor-pointer">
              <Link href="/planos">{t('seePlans')}</Link>
            </Button>
          </div>
        ) : consulta.isPending ? (
          <p className="px-2 py-2 text-meta text-graphite">{t('bestTimeLoading')}</p>
        ) : consulta.isError || !dados ? (
          <p role="alert" className="px-2 py-2 text-meta leading-relaxed text-graphite">
            {t('bestTimeError')}
          </p>
        ) : (
          <>
            {dados.slots.map((slot) => {
              const quando = nextOccurrence(slot);
              return (
                <DropdownMenuItem
                  key={`${slot.weekday}-${slot.hour}`}
                  className="cursor-pointer justify-between gap-3"
                  onSelect={() => onPick(toLocalInput(quando))}
                >
                  <span className="text-compact">
                    {DIAS[slot.weekday]}, {String(slot.hour).padStart(2, '0')}:00
                  </span>
                  <span className="text-meta tabular-nums text-graphite">
                    {quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <div className="flex flex-col gap-1 px-2 pb-1.5">
              {/* a frase sai do SINAL, não de um texto fixo: quando a coleta de métricas existir,
                  `own_engagement` passa a existir e só então falamos de desempenho */}
              <p className="text-meta leading-relaxed text-graphite">
                {dados.signal === 'network_baseline'
                  ? t('bestTimeBaseline')
                  : t('bestTimeOwnHistory', { count: dados.sampleSize })}
              </p>
              {/* design.md §36.3: fuso explícito em agendamento crítico */}
              <p className="text-meta text-graphite">
                {t('bestTimeTimezone', { timezone: dados.timezone })}
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
