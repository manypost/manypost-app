'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Toasts com a paleta de estados do brand — borda + tint, sem sombra. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            '!rounded-lg !border !border-line !bg-surface !text-ink !text-[13px] !shadow-none',
          description: '!text-graphite',
          success: '!border-state-published/40 !bg-state-published-tint !text-state-published',
          error: '!border-state-failed/40 !bg-state-failed-tint !text-state-failed',
          warning: '!border-state-review/40 !bg-state-review-tint !text-state-review',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
