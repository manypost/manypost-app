'use client';

import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ComposerView } from './composer-view';
import { useComposerModal } from './use-composer-modal';

/**
 * Popup global do composer (montado no layout autenticado): grande no desktop,
 * tela cheia no mobile com X no topo direito. O `ComposerView` cuida do corpo
 * rolável + rodapé; aqui só damos a moldura e o cabeçalho.
 */
export function ComposerModal() {
  const t = useTranslations('composer');
  const open = useComposerModal((s) => s.open);
  const setOpen = useComposerModal((s) => s.setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="panel">
        <header className="flex shrink-0 flex-col gap-0.5 border-b border-line px-4 py-3 pr-12 sm:px-6 sm:py-4">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">{t('subtitle')}</DialogDescription>
        </header>
        {open ? <ComposerView onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
