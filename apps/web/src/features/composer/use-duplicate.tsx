'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { fetchChannels, fetchProviders } from '@/features/channels/hooks';
import { fetchMediaList } from '@/features/media/hooks';
import { fetchPostGroup } from '@/features/publications/hooks';
import { useApiErrorMessage } from '@/lib/api/errors';
import { buildDuplicatePrefill } from './duplicate';
import { useComposerStore } from './store';

/**
 * Duplicar um post de qualquer lugar (sheet de detalhe, cards do calendário):
 * busca o detalhe do grupo, monta o rascunho no store e navega p/ /compor.
 * Se já houver rascunho em andamento, pede confirmação antes de substituir —
 * quem usa o hook precisa renderizar `dialog` junto.
 */
export function useDuplicatePost() {
  const t = useTranslations('postDetail');
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  const run = async (groupId: string) => {
    try {
      const [group, channels, providers, media] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['post-group', groupId],
          queryFn: () => fetchPostGroup(groupId),
        }),
        queryClient.ensureQueryData({ queryKey: ['channels'], queryFn: fetchChannels }),
        queryClient.ensureQueryData({
          queryKey: ['providers'],
          queryFn: fetchProviders,
          staleTime: Number.POSITIVE_INFINITY,
        }),
        // biblioteca é só filtro de mídia removida — falha não impede duplicar
        queryClient.ensureQueryData({ queryKey: ['media'], queryFn: fetchMediaList }).catch(() => null),
      ]);
      const { prefill, droppedChannels } = buildDuplicatePrefill({
        group,
        channels,
        providers,
        libraryMediaIds: media ? new Set(media.map((m) => m.id)) : null,
      });
      useComposerStore.getState().loadDraft(prefill);
      if (droppedChannels > 0) toast.info(t('duplicateDropped', { count: droppedChannels }));
      toast.success(t('duplicated'));
      router.push('/compor');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const duplicate = (groupId: string) => {
    const s = useComposerStore.getState();
    const dirty = s.text.trim() !== '' || s.thread.length > 0 || s.mediaIds.length > 0;
    if (dirty) setPendingGroupId(groupId);
    else void run(groupId);
  };

  const dialog = (
    <AlertDialog
      open={pendingGroupId !== null}
      onOpenChange={(open) => !open && setPendingGroupId(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('duplicateTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('duplicateWarning')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('keep')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const id = pendingGroupId;
              setPendingGroupId(null);
              if (id) void run(id);
            }}
          >
            {t('duplicateConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { duplicate, dialog };
}
