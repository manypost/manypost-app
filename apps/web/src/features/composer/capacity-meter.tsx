'use client';

import { cn } from '@/lib/utils';
import { fracaoCapacidade, nivelCapacidade } from './validation';

/**
 * Medidor de capacidade: quanto do limite DAQUELA rede o texto ocupa.
 *
 * É a assinatura visual desta tela — o mesmo texto desenha barras diferentes por rede, uma
 * leitura que só faz sentido num composer multicanal. Os quatro estados saem de tokens que já
 * existem, nenhum token novo (BRAND §2.2): cinza vazio, acento dentro, âmbar de "vale olhar"
 * a partir de 90%, vermelho acima.
 */
const COR: Record<ReturnType<typeof nivelCapacidade>, string> = {
  vazio: 'bg-line',
  ok: 'bg-accent',
  perto: 'bg-state-review',
  acima: 'bg-state-failed',
};

export function CapacityMeter({
  len,
  max,
  className,
}: {
  len: number;
  max: number | undefined;
  className?: string;
}) {
  const nivel = nivelCapacidade(len, max);
  const fracao = fracaoCapacidade(len, max);

  return (
    // decorativo: o número e o rótulo ao lado já dizem a mesma coisa em texto
    <span aria-hidden className={cn('block h-[3px] w-full overflow-hidden rounded-sm bg-line', className)}>
      <span
        className={cn('block h-full rounded-sm transition-[width] duration-200', COR[nivel])}
        style={{ width: `${Math.round(fracao * 100)}%` }}
      />
    </span>
  );
}
