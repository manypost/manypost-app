import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Limite único do conteúdo autenticado; telas podem estreitar dentro dele, nunca substituí-lo. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-app pb-8', className)}>{children}</div>;
}
