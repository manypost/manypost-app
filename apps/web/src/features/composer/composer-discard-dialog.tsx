'use client';

import { useTranslations } from 'next-intl';
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
import { useComposerActions } from './composer-selectors';

/** Descartar sempre pergunta (pedido do owner) — é a única ação do composer que apaga trabalho. */
export function ComposerDiscardDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations('composer');
  const { reset } = useComposerActions();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('discardConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('discardConfirmBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('discardKeep')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              reset();
              onOpenChange(false);
              onDone();
            }}
          >
            {t('discardConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
