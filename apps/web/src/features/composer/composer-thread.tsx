'use client';

import { Plus, Timer, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ComposerEditorCard } from './composer-editor-card';
import {
  useComposerActions,
  useComposerChannelIds,
  useComposerEditorNonce,
  useComposerThread,
} from './composer-selectors';
import { MediaStrip } from './media-picker';
import { useComposerStore } from './store';
import { useSuporteAThread } from './use-composer-validation';

/** esperas oferecidas, em segundos — o cru de 0 a 600 virava um campo numérico sem sentido */
const ESPERAS = [0, 15, 30, 60, 120, 300, 600] as const;

const MAX_ITENS = 24;

/**
 * Réplicas encadeadas (thread).
 *
 * O número do item passou para o conector, que é onde a sequência se lê; os cartões
 * encolheram, porque uma réplica raramente tem o tamanho do post principal; e a espera deixou
 * de ser um `<input type=number>` de 0 a 600 — ninguém digita "437".
 */
export function ComposerThread() {
  const t = useTranslations('composer');
  const thread = useComposerThread();
  const channelIds = useComposerChannelIds();
  const editorNonce = useComposerEditorNonce();
  const { threadSuportada, threadNaoSuportada } = useSuporteAThread();
  const {
    setThreadText,
    setThreadDelay,
    toggleThreadMedia,
    removeThreadItem,
    addThreadItem,
  } = useComposerActions();

  // rede que não aceita thread e nenhum item escrito: a seção inteira não faz sentido
  if (!threadSuportada && thread.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {thread.map((item, i) => (
          // pl-6 no mobile: a 375px cada pixel da coluna conta, e o número cabe em 24px
          <li key={item.key} className="relative pl-6 sm:pl-8">
            {/* conector: a linha liga as réplicas, o número diz a ordem */}
            <span aria-hidden className="absolute bottom-0 left-2.5 top-0 w-px bg-line" />
            <span
              aria-hidden
              className="bevel-surface absolute left-0 top-2 grid size-5 place-items-center rounded-full border text-[10px] font-semibold tabular-nums text-graphite"
            >
              {i + 1}
            </span>
            <ComposerEditorCard
              key={`${item.key}-${editorNonce}`}
              escopo={{ kind: 'thread', threadKey: item.key }}
              initialText={
                useComposerStore.getState().thread.find((x) => x.key === item.key)?.text ?? ''
              }
              onChange={(text) => setThreadText(item.key, text)}
              label={t('threadItem', { index: i + 1 })}
              placeholder={t('threadPlaceholder')}
              aiChannelIds={channelIds}
              media={{
                selectedIds: item.mediaIds,
                onToggle: (mediaId) => toggleThreadMedia(item.key, mediaId),
              }}
              editorClassName="[&_.tiptap]:min-h-16"
              extra={
                <>
                  <EsperaSelect
                    valor={item.delaySec}
                    onChange={(sec) => setThreadDelay(item.key, sec)}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('threadRemove')}
                        className="text-graphite hover:bg-state-failed-tint hover:text-state-failed"
                        onClick={() => removeThreadItem(item.key)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="text-xs font-semibold">
                      {t('threadRemove')}
                    </TooltipContent>
                  </Tooltip>
                </>
              }
            />
            {item.mediaIds.length > 0 ? (
              <div className="pt-2">
                <MediaStrip
                  mediaIds={item.mediaIds}
                  onRemove={(mediaId) => toggleThreadMedia(item.key, mediaId)}
                  size="sm"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      {threadSuportada ? (
        <Button
          variant="ghost"
          size="sm"
          className="bevel-accent w-fit gap-1.5 border-accent text-accent hover:text-accent-hover"
          disabled={thread.length >= MAX_ITENS}
          onClick={() => addThreadItem()}
        >
          <Plus aria-hidden />
          {t('threadAdd')}
        </Button>
      ) : (
        <p className="text-[13px] leading-relaxed text-state-failed">
          {t('threadUnavailable', { channels: threadNaoSuportada.join(', ') })}
        </p>
      )}
    </div>
  );
}

/** espera antes desta réplica — controle compacto, na barra do próprio cartão */
function EsperaSelect({ valor, onChange }: { valor: number; onChange: (sec: number) => void }) {
  const t = useTranslations('composer.delay');
  // valor fora da lista (rascunho antigo com o campo cru) continua selecionável
  const opcoes = ESPERAS.includes(valor as (typeof ESPERAS)[number])
    ? [...ESPERAS]
    : [...ESPERAS, valor].sort((a, b) => a - b);

  return (
    <Select value={String(valor)} onValueChange={(v) => onChange(Number(v))}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SelectTrigger
            aria-label={t('label')}
            className="h-8 w-auto gap-1 border-line px-2 text-[11px] font-semibold text-graphite"
          >
            <Timer className="size-3.5 shrink-0" aria-hidden />
            <SelectValue />
          </SelectTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-56 text-xs font-semibold">
          {t('hint')}
        </TooltipContent>
      </Tooltip>
      <SelectContent>
        {opcoes.map((sec) => (
          <SelectItem key={sec} value={String(sec)}>
            {sec === 0 ? t('none') : t('value', { sec })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
