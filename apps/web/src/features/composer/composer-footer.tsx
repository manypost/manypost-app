'use client';

import { AlertTriangle, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Label } from '@/components/ui/label';
import { BestTimeHint } from '@/features/ai/best-time-hint';
import { toLocalInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  useComposerActions,
  useComposerChannelIds,
  useComposerPublishAtLocal,
  useComposerRequireApproval,
} from './composer-selectors';
import { podeAgendarPorAtalho } from './composer-shortcut';
import { ComposerValidationPopover } from './composer-validation-popover';
import { draftPersistenceMonitor } from './draft-persistence';
import { useComposerSubmit } from './use-composer-submit';
import { useComposerValidation } from './use-composer-validation';

/** o CTA travado aponta para a explicação por `aria-describedby` */
const ID_BLOQUEIO = 'composer-bloqueio';

/**
 * Rodapé em dois blocos: QUANDO (horário, aprovação) e AÇÕES.
 *
 * O `<span>` com a primeira issue saiu daqui. Ele montava e desmontava a cada tecla e, com o
 * foco parado no `<body>`, cada nó removido fazia o `MutationObserver` do `FocusScope` roubar o
 * foco para o container do diálogo — parte de por que o editor "morria". A explicação agora é o
 * mesmo popover de validação do resto da tela, e o CTA travado aponta para ela.
 */
export function ComposerFooter({
  onDone,
  onDiscard,
  overlayBloqueanteAberto = false,
}: {
  onDone: () => void;
  /** abre a confirmação de descarte, que mora na casca */
  onDiscard: () => void;
  /** impede que o atalho atravesse um diálogo de confirmação sobre o composer */
  overlayBloqueanteAberto?: boolean;
}) {
  const t = useTranslations('composer');
  const { setPublishAtLocal, setRequireApproval } = useComposerActions();
  const publishAtLocal = useComposerPublishAtLocal();
  const requireApproval = useComposerRequireApproval();
  const channelIds = useComposerChannelIds();
  const { selected, issues, scheduleIssues, publishAt } = useComposerValidation();
  const { submit, isPending } = useComposerSubmit(onDone);

  const travado = issues.length > 0;
  const travadoParaAgendar = travado || scheduleIssues.length > 0;

  // Ctrl/Cmd + Enter agenda. Vive no documento porque o composer é um diálogo modal: o atalho
  // vale de qualquer campo dele, inclusive de dentro do editor. O que ele executa fica numa ref
  // para o listener não ser trocado a cada tecla — o rodapé re-renderiza junto com a validação.
  const agendar = useRef<(repeticao: boolean) => void>(() => {});
  agendar.current = (repeticao) => {
    if (
      !podeAgendarPorAtalho({
        bloqueado: travadoParaAgendar,
        enviando: isPending,
        overlayBloqueanteAberto,
        repeticao,
      })
    ) {
      return;
    }
    submit({ agora: false, selected, publishAt });
  };
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      agendar.current(e.repeat);
    };
    document.addEventListener('keydown', atalho);
    return () => document.removeEventListener('keydown', atalho);
  }, []);

  return (
    <footer className="bg-surface shrink-0 border-t border-line px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* a 375px o rótulo formatado ("Sex., 17 de jul., 08:00") é o item mais largo do
                rodapé: ocupa a linha e trunca em vez de empurrar o resto para fora */}
            <DateTimePicker
              value={publishAtLocal}
              min={toLocalInput(new Date())}
              onChange={setPublishAtLocal}
              ariaLabel={t('modeSchedule')}
              className="min-w-0 flex-1 [&>span]:truncate sm:flex-none"
            />
            <BestTimeHint channelId={channelIds[0]} onPick={setPublishAtLocal} />
            <div className="flex shrink-0 items-center gap-2">
              <Checkbox
                id="require-approval"
                checked={requireApproval}
                onCheckedChange={(checked) => setRequireApproval(checked === true)}
              />
              <Label htmlFor="require-approval">{t('approval')}</Label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-mist">
            <span className="hidden sm:inline">{t('footer.shortcut')}</span>
            <IndicadorRascunho />
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end lg:ml-auto">
          <ComposerValidationPopover
            escopo={{ kind: 'all' }}
            variante="footer"
            incluirAgendamento
            id={ID_BLOQUEIO}
            className="self-start sm:self-end"
          />
          {/* no mobile: descartar + publicar-agora dividem a linha, o CTA principal ocupa tudo */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:justify-end">
            {/* a 360px cada célula da grade tem ~160px: o padding aperta e o rótulo encurta,
                senão "Descartar rascunho" (166px) vaza da própria célula */}
            <Button
              variant="outline"
              className="w-full px-3 hover:border-state-failed hover:bg-state-failed-tint hover:text-state-failed sm:w-auto sm:px-5"
              disabled={isPending}
              onClick={onDiscard}
            >
              <span className="sm:hidden">{t('footer.discardShort')}</span>
              <span className="hidden sm:inline">{t('discard')}</span>
            </Button>
            {!requireApproval ? (
              <Button
                variant="outline"
                className="w-full px-3 sm:w-auto sm:px-5"
                disabled={travado}
                aria-describedby={travado ? ID_BLOQUEIO : undefined}
                isLoading={isPending}
                onClick={() => submit({ agora: true, selected, publishAt })}
              >
                {t('submitNow')}
              </Button>
            ) : null}
            <Button
              className={cn('w-full sm:w-auto', requireApproval ? '' : 'col-span-2 sm:col-auto')}
              disabled={travadoParaAgendar}
              aria-describedby={travadoParaAgendar ? ID_BLOQUEIO : undefined}
              isLoading={isPending}
              onClick={() => submit({ agora: false, selected, publishAt })}
            >
              {requireApproval ? t('submitDraft') : t('submitSchedule')}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}

/**
 * Confirma o rascunho somente depois que o adapter de storage conclui a escrita.
 */
function IndicadorRascunho() {
  const t = useTranslations('composer');
  const persistencia = useSyncExternalStore(
    draftPersistenceMonitor.subscribe,
    draftPersistenceMonitor.getSnapshot,
    draftPersistenceMonitor.getSnapshot,
  );
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (persistencia.status === 'idle' || persistencia.status === 'saving') {
      setVisivel(false);
      return;
    }
    setVisivel(true);
    const timer = setTimeout(() => setVisivel(false), 3500);
    return () => clearTimeout(timer);
  }, [persistencia]);

  if (!visivel) return null;
  if (persistencia.status === 'failed') {
    return (
      <span className="flex items-center gap-1 text-state-failed" role="status">
        <AlertTriangle className="size-3" aria-hidden />
        {t('footer.saveFailed')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-accent" role="status">
      <Check className="size-3" aria-hidden />
      {t('footer.saved')}
    </span>
  );
}
