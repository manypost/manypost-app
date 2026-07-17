'use client';

import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ComposerView } from './composer-view';
import { useComposerModal } from './use-composer-modal';

/**
 * Modal de criação de post — popup grande no padrão da tela de criação (SPEC_FRONTEND §3.3),
 * aberto sobre o calendário/kanban. Reusa o `ComposerView` inteiro; `onDone` fecha o modal
 * ao publicar/agendar/descartar (na rota /compor, sem onDone, ele navega para o calendário).
 * Montado uma vez no shell autenticado.
 */
export function ComposerModal() {
  const t = useTranslations('composer');
  const open = useComposerModal((s) => s.open);
  const close = useComposerModal((s) => s.closeComposer);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[92vh] sm:w-[97vw] sm:max-w-[1640px] sm:rounded-md sm:border">
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <ComposerView onDone={close} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
