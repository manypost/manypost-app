'use client';

import { Check, ImagePlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaList } from '@/features/media/hooks';
import { MediaThumb } from '@/features/media/media-thumb';
import { UploadZone } from '@/features/media/upload-zone';
import { cn } from '@/lib/utils';

/**
 * Picker de mídia do composer: biblioteca + upload inline. Arquivo recém
 * enviado já entra selecionado (onUploaded → toggle).
 */
export function MediaPicker({
  selectedIds,
  onToggle,
  triggerLabel,
}: {
  selectedIds: string[];
  onToggle: (mediaId: string) => void;
  triggerLabel?: string;
}) {
  const t = useTranslations('composer.media');
  const [open, setOpen] = useState(false);
  const media = useMediaList();

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <ImagePlus aria-hidden />
        {triggerLabel ?? t('add')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('pickerTitle')}</DialogTitle>
            <DialogDescription>{t('pickerHint')}</DialogDescription>
          </DialogHeader>
          <UploadZone
            compact
            onUploaded={(id) => {
              if (!selectedIds.includes(id)) onToggle(id);
            }}
          />
          {media.isPending ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : media.isError || (media.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-graphite">{t('pickerEmpty')}</p>
          ) : (
            <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {media.data!.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onToggle(item.id)}
                      className={cn(
                        'relative block w-full overflow-hidden rounded-md border-2 outline-none transition-colors duration-200',
                        selected ? 'border-accent' : 'border-line hover:border-accent',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      )}
                    >
                      <MediaThumb url={item.url} mime={item.mime} alt={item.alt} className="aspect-square" />
                      {selected ? (
                        <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-paper">
                          <Check className="size-3" aria-hidden />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{t('done', { count: selectedIds.length })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Fita de miniaturas selecionadas com remover — post principal e itens de thread. */
export function MediaStrip({
  mediaIds,
  onRemove,
  size = 'md',
}: {
  mediaIds: string[];
  onRemove: (mediaId: string) => void;
  size?: 'md' | 'sm';
}) {
  const t = useTranslations('composer.media');
  const media = useMediaList();
  if (mediaIds.length === 0) return null;
  const byId = new Map((media.data ?? []).map((m) => [m.id, m]));

  return (
    <ul className="flex flex-wrap gap-2">
      {mediaIds.map((id) => {
        const item = byId.get(id);
        return (
          <li key={id} className="group relative">
            {item ? (
              <MediaThumb
                url={item.url}
                mime={item.mime}
                alt={item.alt}
                className={cn('rounded-md border border-line', size === 'md' ? 'size-20' : 'size-14')}
              />
            ) : (
              <Skeleton className={cn('rounded-md', size === 'md' ? 'size-20' : 'size-14')} />
            )}
            <button
              type="button"
              aria-label={t('remove')}
              onClick={() => onRemove(id)}
              className={cn(
                'absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-graphite outline-none transition-colors duration-200',
                'hover:border-state-failed hover:text-state-failed',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              )}
            >
              <X className="size-3" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
