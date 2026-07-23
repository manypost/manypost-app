import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Badge do brand (§7B) + chips de estado de publicação (§3.1): tint de fundo
 * com a cor cheia como texto, radius 4px, 11px semibold uppercase.
 */
const badgeVariants = cva(
  'bevel-chip inline-flex items-center gap-1 rounded-sm border border-transparent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200',
  {
    variants: {
      variant: {
        neutral: 'border-line bg-surface text-graphite',
        accent: 'bg-accent-tint text-accent',
        solid: 'bg-accent text-paper',
        scheduled: 'bg-state-scheduled-tint text-state-scheduled',
        publishing: 'bg-state-publishing-tint text-state-publishing',
        published: 'bg-state-published-tint text-state-published',
        failed: 'bg-state-failed-tint text-state-failed',
        review: 'bg-state-review-tint text-state-review',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
