'use client';

import { CircleAlert, ImageOff, Link2, Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useApiErrorMessage } from '@/lib/api/errors';
import type { components } from '@/lib/api/schema';
import {
  useDeleteMedia,
  useImportMediaFromUrl,
  useMediaList,
  useUpdateMediaAlt,
} from './hooks';
import { MediaThumb, formatBytes } from './media-thumb';
import { UploadZone } from './upload-zone';

type Media = components['schemas']['Media'];

/** Biblioteca de mídia (SPEC_FRONTEND §2): upload, importar por URL, alt, excluir. */
export function MediaView() {
  const t = useTranslations('media');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const media = useMediaList();
  const importUrl = useImportMediaFromUrl();
  const updateAlt = useUpdateMediaAlt();
  const remove = useDeleteMedia();

  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [altTarget, setAltTarget] = useState<Media | null>(null);
  const [altValue, setAltValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Media | null>(null);

  const submitImport = () => {
    importUrl.mutate(
      { url: importValue.trim() },
      {
        onSuccess: () => {
          toast.success(t('imported'));
          setImportOpen(false);
          setImportValue('');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const submitAlt = () => {
    if (!altTarget) return;
    updateAlt.mutate(
      { id: altTarget.id, alt: altValue.trim() === '' ? null : altValue.trim() },
      {
        onSuccess: () => {
          toast.success(t('altSaved'));
          setAltTarget(null);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <UploadZone />
        <div className="flex items-center justify-between">
          <span className="text-xs text-graphite">{t('urlHint')}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
            <Link2 aria-hidden />
            {t('importUrl')}
          </Button>
        </div>
      </div>

      {media.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : media.isError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {errorMessage(media.error)}
            <Button variant="outline" size="sm" onClick={() => media.refetch()}>
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : media.data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface-2 px-6 py-16 text-center">
          <ImageOff className="size-8 text-mist" aria-hidden />
          <p className="text-sm leading-relaxed text-graphite">{t('empty')}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {media.data.map((item) => (
            <li
              key={item.id}
              className="group overflow-hidden rounded-lg border border-line bg-surface transition-colors duration-200 hover:border-accent"
            >
              <MediaThumb url={item.url} mime={item.mime} alt={item.alt} className="aspect-square" />
              <div className="flex items-center justify-between gap-1 border-t border-line px-2.5 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-graphite">
                    {item.alt ? item.alt : t('noAlt')}
                  </span>
                  <span className="block text-[11px] text-mist">
                    {formatBytes(item.byteSize, locale)}
                    {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                  </span>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('editAlt')}
                      onClick={() => {
                        setAltTarget(item);
                        setAltValue(item.alt ?? '');
                      }}
                    >
                      <Pencil aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('editAlt')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('delete')}
                      className="text-state-failed hover:text-state-failed"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('delete')}</TooltipContent>
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* importar por URL */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('importUrl')}</DialogTitle>
            <DialogDescription>{t('importUrlHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-url">URL</Label>
            <Input
              id="import-url"
              type="url"
              placeholder="https://…"
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && importValue.trim()) submitImport();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={submitImport}
              disabled={importValue.trim() === ''}
              isLoading={importUrl.isPending}
            >
              {t('importCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* editar alt */}
      <Dialog open={altTarget !== null} onOpenChange={(open) => !open && setAltTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editAlt')}</DialogTitle>
            <DialogDescription>{t('altHint')}</DialogDescription>
          </DialogHeader>
          {altTarget ? (
            <MediaThumb
              url={altTarget.url}
              mime={altTarget.mime}
              alt={altTarget.alt}
              className="mx-auto aspect-square w-40 rounded-md border border-line"
            />
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="alt-text">{t('altLabel')}</Label>
            <Input
              id="alt-text"
              value={altValue}
              onChange={(e) => setAltValue(e.target.value)}
              placeholder={t('altPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAlt();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAltTarget(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={submitAlt} isLoading={updateAlt.isPending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* excluir (soft) */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                remove.mutate(deleteTarget.id, {
                  onSuccess: () => toast.success(t('deleted')),
                  onError: (err) => toast.error(errorMessage(err)),
                });
                setDeleteTarget(null);
              }}
            >
              {t('deleteCta')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
