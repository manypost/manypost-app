'use client';

import type { ReactNode } from 'react';

/**
 * Rótulo de seção do composer — mesmo header curto do calendário/billing, para as regiões
 * (Canais · Conteúdo · Pré-visualização) lerem como blocos distintos.
 */
export function SectionHeader({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-graphite">{label}</h2>
      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
