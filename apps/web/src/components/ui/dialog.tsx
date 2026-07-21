'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn('fixed inset-0 z-50 animate-fade-in bg-night/40', className)}
      {...props}
    />
  );
}

/**
 * Hierarquia por borda + camadas de fundo — sem sombra (BRAND §2.2).
 * `size="panel"` = popup grande e mobile-first: ocupa a tela inteira no mobile
 * (X no topo direito) e vira um cartão amplo centralizado no desktop. O miolo
 * (header/scroll/rodapé) é montado por quem usa — o content só dá a moldura.
 */
function DialogContent({
  className,
  children,
  size = 'default',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { size?: 'default' | 'panel' }) {
  const base =
    size === 'panel'
      ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface animate-fade-in outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[90dvh] sm:max-h-[920px] sm:w-[calc(100vw-2rem)] sm:max-w-[1640px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:border-line'
      : 'fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-md border border-line bg-surface p-6 animate-fade-in';
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content data-slot="dialog-content" className={cn(base, className)} {...props}>
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 z-20 grid size-8 place-items-center rounded-sm text-graphite outline-none transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none">
          <X className="size-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg font-semibold tracking-[-0.2px] text-ink', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm leading-relaxed text-graphite', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
