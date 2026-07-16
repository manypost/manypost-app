'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tabs do kit adaptadas ao brand: trilho em --surface-2 com borda, aba ativa
 * vira --surface com texto --ink (hierarquia por camada de fundo, sem sombra).
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-10 w-fit max-w-full items-center gap-1 overflow-x-auto rounded-md border border-line bg-surface-2 p-1',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1 text-[13px] font-semibold text-graphite transition-colors duration-200',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink',
        'disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
