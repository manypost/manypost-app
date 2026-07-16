'use client';

import { Film } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Miniatura de mídia (imagem ou vídeo) — quadrada, object-cover, sem sombra. */
export function MediaThumb({
  url,
  mime,
  alt,
  className,
}: {
  url: string;
  mime: string;
  alt?: string | null;
  className?: string;
}) {
  if (mime.startsWith('video/')) {
    return (
      <span className={cn('relative block overflow-hidden bg-surface-2', className)}>
        {/* preload=metadata desenha o primeiro frame como poster */}
        <video src={url} muted preload="metadata" className="size-full object-cover" />
        <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-sm bg-night/60">
          <Film className="size-3 text-paper" aria-hidden />
        </span>
      </span>
    );
  }
  return (
    <span className={cn('block overflow-hidden bg-surface-2', className)}>
      <img src={url} alt={alt ?? ''} loading="lazy" className="size-full object-cover" />
    </span>
  );
}

/** "1,2 MB" no locale do app */
export function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 'B';
  for (const u of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = u;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}
