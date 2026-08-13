import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Logo completa (ícone + wordmark `manypost` em curvas) — `public/images/logo.svg`.
 * O SVG já inclui o texto; não duplicar "manypost" ao lado.
 * Para só o mark quadrado (sidebar recolhida, favicon-like), use `logoSimplificada.svg`.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo.svg"
      alt="manypost"
      width={107}
      height={28}
      className={cn(className)}
      priority
    />
  );
}
