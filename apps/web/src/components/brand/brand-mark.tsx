'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Logo da marca com fases full → spinning → static.
 * No app, o trigger é o recolher/expandir da sidebar (`compact`), não scroll.
 *
 * Assets:
 * - full: `/images/logo.svg` (wordmark horizontal com manypost)
 * - spinning: `/images/logo-icon-animated.svg` (só o símbolo gira)
 * - static: `/images/logoSimplificada.svg` (mark 1×1)
 *
 * `ready`: só anima depois que o caller hidratou preferências (localStorage).
 * No primeiro `ready` aplica a fase final sem spin — evita girar no reload.
 */
type Phase = 'full' | 'spinning' | 'static';

const SPIN_HOLD_MS = 1800;
const SPIN_SRC = '/images/logo-icon-animated.svg';

export function BrandMark({
  compact,
  ready = true,
  className,
}: {
  /** true = sidebar recolhida (ícone); false = expandida (wordmark). */
  compact: boolean;
  /** false até o caller ler preferências persistidas — sem animação no boot. */
  ready?: boolean;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>('full');
  const [spinSrc, setSpinSrc] = useState(SPIN_SRC);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armed = useRef(false);

  function clearSettleTimer() {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }

  useEffect(() => {
    if (!ready) return;

    // Primeira aplicação pós-hydrate: fase final, sem spin.
    if (!armed.current) {
      armed.current = true;
      setPhase(compact ? 'static' : 'full');
      return;
    }

    clearSettleTimer();

    if (!compact) {
      setPhase('full');
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setPhase('static');
      return;
    }

    // Reinicia animação CSS do SVG via <img> (não recomeça sozinha).
    setSpinSrc(`${SPIN_SRC}?t=${Date.now()}`);
    setPhase('spinning');
    settleTimer.current = setTimeout(() => {
      setPhase('static');
      settleTimer.current = null;
    }, SPIN_HOLD_MS);
  }, [compact, ready]);

  useEffect(() => () => clearSettleTimer(), []);

  return (
    <span className={cn('brand-mark', className)} data-phase={phase}>
      {/* <img>: SVG animado precisa recarregar src; next/image atrapalha o restart */}
      <img
        src="/images/logo.svg"
        alt="manypost"
        width={107}
        height={28}
        className="brand-mark__full"
        data-logo="full"
        fetchPriority="high"
        decoding="async"
      />
      <img
        src={spinSrc}
        alt=""
        width={28}
        height={28}
        className="brand-mark__spin"
        data-logo="spin"
        aria-hidden
        decoding="async"
      />
      <img
        src="/images/logoSimplificada.svg"
        alt=""
        width={28}
        height={28}
        className="brand-mark__static"
        data-logo="static"
        aria-hidden
        decoding="async"
      />
    </span>
  );
}
