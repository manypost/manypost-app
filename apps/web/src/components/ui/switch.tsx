'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';
import { cn } from '@/lib/utils';

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-line transition-colors duration-200',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-2',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-surface ring-0 transition-transform duration-200',
          'data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0.5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
