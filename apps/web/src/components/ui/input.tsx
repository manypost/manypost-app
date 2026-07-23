import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'inset-field flex h-[38px] w-full rounded-md border px-3 py-1 text-[13px] text-ink transition-colors duration-200',
        'placeholder:text-mist file:border-0 file:bg-transparent file:text-[13px] file:font-semibold',
        'outline-none focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        'aria-invalid:border-state-failed aria-invalid:focus-visible:outline-state-failed',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
