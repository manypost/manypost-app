import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Logo (mark roxo 28px) + wordmark `manypost` — sempre minúsculo (regra da marca). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image src="/images/logo.png" alt="" width={28} height={28} className="rounded-sm" priority />
      <span className="font-display text-lg font-bold tracking-[-0.3px] text-ink">manypost</span>
    </span>
  );
}
