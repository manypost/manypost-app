import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Sistema de botões do brand (BRAND §6): 5 variantes × 3 tamanhos, radius 6px,
 * foco por outline (não ring, que é box-shadow). Variantes preenchidas têm
 * relevo 3D sem sombra (classes `.bevel-*` em globals.css): topo claro, base
 * escura, bordas por lado. Hover só escurece/clareia (`brightness`) — nunca
 * translate/scale, o elemento fica firme. Ghost e link seguem flat.
 */
const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold transition duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  {
    variants: {
      variant: {
        primary: 'bevel-primary text-paper hover:brightness-95',
        enterprise: 'bevel-enterprise text-paper hover:brightness-150',
        outline: 'bevel-outline text-ink hover:brightness-90',
        ghost: 'border-transparent text-ink hover:bg-surface-2 hover:text-accent',
        link: 'h-auto border-0 p-0 text-accent underline-offset-4 hover:text-accent-hover hover:underline',
        destructive: 'bevel-destructive text-paper hover:brightness-95',
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
