import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Limite único do conteúdo autenticado; `wide` abriga superfícies operacionais como o Quadro. */
export function PageShell({
  children,
  className,
  size = 'wide',
}: {
  children: ReactNode;
  className?: string;
  size?: 'standard' | 'wide';
}) {
  return (
    <div className={cn('mx-auto w-full pb-8', size === 'wide' ? 'max-w-wide' : 'max-w-app', className)}>
      {children}
    </div>
  );
}
