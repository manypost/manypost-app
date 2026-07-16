import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink transition-colors duration-200',
        'placeholder:text-mist',
        'outline-none focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        'aria-invalid:border-state-failed aria-invalid:focus-visible:outline-state-failed',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
