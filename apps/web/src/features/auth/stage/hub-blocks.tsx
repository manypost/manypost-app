'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from './carousel';

/**
 * Barra de blocos do hub — porte do `HubBlocks.astro` da landing: uma onda de
 * sombreado (░▒▓█) varrendo, como um terminal trabalhando.
 *
 * Diferenças do original, todas de contexto: menos blocos (o card do hub aqui
 * é bem menor que o da landing, e 34 blocos ficariam quase todos cortados) e
 * acento sobre escuro. Sob movimento reduzido a onda não roda — fica o quadro
 * inicial, sem `setInterval`.
 */

const BLOCK_N = 20;
const BLOCK_CHARS = ['░', '▒', '▓', '█'] as const;
const PERIOD = BLOCK_N + 8;

function blockFrame(crest: number): string {
  let out = '';
  for (let i = 0; i < BLOCK_N; i++) {
    const distance = Math.abs(i - crest);
    const level = distance < 1.5 ? 3 : distance < 3 ? 2 : distance < 4.5 ? 1 : 0;
    out += BLOCK_CHARS[level];
  }
  return out;
}

export function HubBlocks() {
  const reducedMotion = useReducedMotion();
  const [blocks, setBlocks] = useState(() => blockFrame(BLOCK_N - 5));

  useEffect(() => {
    if (reducedMotion) return;
    let tick = 0;
    const id = window.setInterval(() => {
      tick = (tick + 1) % PERIOD;
      setBlocks(blockFrame(tick - 4));
    }, 45);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  return (
    <div className="flex h-[18px] w-full items-center justify-center overflow-hidden" aria-hidden>
      <span className="block select-none whitespace-nowrap text-center font-mono text-xs leading-[18px] tracking-[-0.5px] text-accent-on-dark">
        {blocks}
      </span>
    </div>
  );
}
