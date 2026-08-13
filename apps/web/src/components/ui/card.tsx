import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Card de app (densidade docs/brand/README.md §2): fill branco chapado, borda 1px em `--line`,
 * raio de cartão de 11px (sistema branco/lilás v2.0).
 *
 * O que o faz parecer elevado não é relevo — é a camada: `--surface` branco sobre o `--canvas` da
 * página. Borda decorativa, sem piso de contraste, porque o card nunca é a única coisa que
 * identifica um componente (ao contrário de um overlay, que usa `--line-strong`).
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-card border border-line bg-surface text-card-foreground', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('text-panel font-medium text-ink', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-compact leading-relaxed text-graphite', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-6 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-footer" className={cn('flex items-center p-6 pt-0', className)} {...props} />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
