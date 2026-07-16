'use client';

import { UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApiErrorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { useUploadMedia } from './hooks';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm';

/**
 * Zona de upload (clique ou arrastar) — usada na biblioteca e no picker do
 * composer. Envia arquivos em sequência; o MIME real é validado no servidor
 * por magic bytes (o accept é só conveniência).
 */
export function UploadZone({
  onUploaded,
  compact = false,
  className,
}: {
  onUploaded?: (mediaId: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations('media');
  const errorMessage = useApiErrorMessage();
  const upload = useUploadMedia();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busyCount, setBusyCount] = useState(0);

  const sendFiles = async (files: FileList | File[]) => {
    const list = [...files];
    if (list.length === 0) return;
    setBusyCount(list.length);
    for (const file of list) {
      try {
        const media = await upload.mutateAsync({ file });
        onUploaded?.(media.id);
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err)}`);
      } finally {
        setBusyCount((n) => n - 1);
      }
    }
  };

  const busy = busyCount > 0;

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void sendFiles(e.dataTransfer.files);
      }}
      disabled={busy}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center outline-none transition-colors duration-200',
        compact ? 'px-4 py-6' : 'px-6 py-10',
        dragOver ? 'border-accent bg-accent-tint' : 'border-line bg-surface-2 hover:border-accent',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-progress disabled:opacity-70',
        className,
      )}
    >
      <UploadCloud className={cn('text-graphite', compact ? 'size-5' : 'size-7')} aria-hidden />
      <span className="text-sm font-semibold text-ink">
        {busy ? t('uploading', { count: busyCount }) : t('dropHere')}
      </span>
      {!compact ? <span className="text-xs text-graphite">{t('dropHint')}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) void sendFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </button>
  );
}
