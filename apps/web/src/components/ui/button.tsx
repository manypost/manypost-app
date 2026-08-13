import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Sistema de botões do brand (v2.0): 5 variantes × 3 tamanhos, raio de controle de 10px e foco por
 * outline (a única sombra autorizada pertence ao tooltip).
 *
 * **Preenchimento chapado.** O hover usa transição de cor em 200ms, sem gradiente decorativo,
 * deslocamento ou escala.
 *
 * `outline` carrega `border-line-strong`: sem relevo, a borda é o único limite do controle, e o
 * piso de 3:1 da WCAG 1.4.11 se aplica. Ghost e link não têm limite desenhado — são texto.
 *
 * A variante histórica `enterprise` permanece removida: não existe papel visual separado para ela.
 */
const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control border font-medium transition-colors duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  {
    variants: {
      variant: {
        primary: 'border-accent bg-accent text-paper hover:border-accent-hover hover:bg-accent-hover',
        outline: 'border-line-strong bg-surface text-ink hover:bg-surface-2',
        ghost: 'border-transparent text-ink hover:bg-surface-2 hover:text-accent',
        link: 'h-auto border-0 p-0 text-accent underline-offset-4 hover:text-accent-hover hover:underline',
        destructive:
          'border-destructive bg-destructive text-paper hover:border-destructive-hover hover:bg-destructive-hover',
      },
      size: {
        sm: 'h-8 px-3.5 text-meta',
        md: 'h-[38px] px-5 text-compact',
        lg: 'h-11 px-7 text-panel font-semibold',
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
          {/* design.md §46.12: animação contínua respeita reduced-motion. Sob redução o ícone
              fica parado e quem comunica o estado é o `aria-busy` + o label preservado. */}
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
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
