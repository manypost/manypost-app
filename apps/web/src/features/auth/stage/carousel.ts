'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Lógica de sequência do palco da marca, separada da renderização para poder
 * ser testada sem DOM (mesmo padrão de `auth-flow.ts`). As duas funções abaixo
 * são puras; o hook só as compõe com o estado do React.
 */

/** Índice circular seguro: aceita qualquer inteiro e devolve sempre 0..count-1. */
export function wrapIndex(next: number, count: number): number {
  if (count <= 0) return 0;
  return ((next % count) + count) % count;
}

/**
 * Autoplay só corre em repouso, com movimento permitido e havendo para onde ir.
 * Pausa vem de hover/foco no palco; `reducedMotion` espelha a media query.
 */
export function autoplayEligible(input: {
  paused: boolean;
  reducedMotion: boolean;
  count: number;
}): boolean {
  return !input.paused && !input.reducedMotion && input.count > 1;
}

/** Espelha `prefers-reduced-motion: reduce`, reagindo a mudanças do sistema. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return reduced;
}

export type Carousel = {
  index: number;
  /** Muda a cada avanço — usado para reiniciar a barra de progresso do autoplay. */
  cycle: number;
  paused: boolean;
  reducedMotion: boolean;
  autoplay: boolean;
  goTo: (next: number) => void;
  setPaused: (paused: boolean) => void;
};

export function useCarousel(count: number, intervalMs: number): Carousel {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const autoplay = autoplayEligible({ paused, reducedMotion, count });

  const goTo = useCallback(
    (next: number) => {
      setIndex(wrapIndex(next, count));
      setCycle((c) => c + 1);
    },
    [count],
  );

  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => {
      setIndex((i) => wrapIndex(i + 1, count));
      setCycle((c) => c + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoplay, count, intervalMs]);

  return { index, cycle, paused, reducedMotion, autoplay, goTo, setPaused };
}
