import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Sistema de botões do brand (BRAND §6): 5 variantes × 3 tamanhos, radius 6px,
 * hover só de cor em 0.2s — nunca translate/scale — e foco por outline (não
 * ring, que é box-shadow).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-semibold transition-colors duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-paper hover:bg-accent-hover',
        enterprise: 'bg-ink text-paper hover:bg-ink-soft',
        outline: 'border-line bg-surface text-ink hover:border-ink hover:bg-surface-2',
        ghost: 'text-ink hover:bg-surface-2 hover:text-accent',
        link: 'h-auto p-0 text-accent underline-offset-4 hover:text-accent-hover hover:underline',
        destructive: 'bg-destructive text-paper hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-3.5 text-[11px]',
        md: 'h-[38px] px-5 text-[13px]',
        lg: 'h-11 px-7 text-[15px] font-bold',
        icon: 'size-[38px]',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

/** Açúcar do kit p/ submits assíncronos. */
function ButtonLoading(props: ButtonProps) {
  return <Button isLoading {...props} />;
}

export { Button, ButtonLoading, buttonVariants };
