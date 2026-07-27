'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DraftFromIdea } from '@/features/ai/draft-from-idea';
import { useChannels, useProviders } from '@/features/channels/hooks';
import { toLocalInput } from '@/lib/datetime';
import { ChannelPicker } from './channel-picker';
import { ComposerChannelTab } from './composer-channel-tab';
import { ComposerDiscardDialog } from './composer-discard-dialog';
import { ComposerFooter } from './composer-footer';
import { ComposerGlobalTab } from './composer-global-tab';
import { ComposerNetworkTabs, idDaAba, idDoPainel } from './composer-network-tabs';
import { ComposerPreviewPane } from './composer-preview-pane';
import {
  useComposerActions,
  useComposerChannelIds,
  useComposerPublishAtLocal,
} from './composer-selectors';
import { ComposerThread } from './composer-thread';
import { useComposerUiStore } from './composer-ui-store';
import { SectionHeader } from './section-header';
import { useCanaisSelecionados } from './use-composer-validation';

/**
 * Composer (SPEC_FRONTEND §3.3): vive dentro do popup (composer-modal).
 *
 * Este arquivo é só a CASCA — grade, seções e composição. Cada região assina o que lê:
 * o texto vive nas folhas que o editam, e digitar não re-renderiza o trilho de redes, a prévia
 * nem o rodapé inteiro. Antes eram 788 linhas assinando o store inteiro sem seletor.
 *
 * O corpo rola; o rodapé fica fixo no pé do popup. `onDone` fecha o popup (submit ok ou
 * descartar).
 */
export function ComposerView({ onDone }: { onDone: () => void }) {
  const t = useTranslations('composer');
  const { toggleChannel, setOverride, bumpEditors, setPublishAtLocal } = useComposerActions();
  const channelIds = useComposerChannelIds();
  const publishAtLocal = useComposerPublishAtLocal();
  const selected = useCanaisSelecionados();
  const providers = useProviders();
  const totalDeCanais = useChannels().data?.length ?? 0;
  const activeTab = useComposerUiStore((s) => s.activeTab);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  // o rascunho vem de localStorage: só depois de montar o cliente é que ele existe
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  // fechar o popup desmonta a view: qual aba estava aberta não é conteúdo e não sobrevive
  const resetUi = useComposerUiStore((s) => s.resetUi);
  useEffect(() => resetUi, [resetUi]);

  // primeiro uso: sugere a próxima hora cheia
  useEffect(() => {
    if (!montado || publishAtLocal) return;
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    setPublishAtLocal(toLocalInput(d));
  }, [montado, publishAtLocal, setPublishAtLocal]);

  if (!montado) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-56 rounded-lg" />
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // a aba cai para a global quando o canal em edição sai da seleção
  const abaAtual =
    activeTab === 'global' || selected.some((ch) => ch.id === activeTab) ? activeTab : 'global';
  const canalDaAba = selected.find((ch) => ch.id === abaAtual);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section>
              <SectionHeader label={t('sections.channels')}>
                {totalDeCanais > 0 ? (
                  <span className="text-[11px] font-medium tabular-nums text-mist">
                    {t('sections.channelsCount', {
                      selected: selected.length,
                      total: totalDeCanais,
                    })}
                  </span>
                ) : null}
              </SectionHeader>
              <ChannelPicker selectedIds={channelIds} onToggle={toggleChannel} />
            </section>

            <section className="flex flex-col gap-3 border-t border-line pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionHeader label={t('sections.content')} />
                {/* a ideia vira um texto por canal: chega como override, exatamente o formato
                    que `textByChannel` do agendamento já aceita — nada é agendado aqui */}
                <DraftFromIdea
                  channelIds={channelIds}
                  onDrafts={(drafts) => {
                    for (const d of drafts) setOverride(d.channelId, d.text);
                    bumpEditors();
                  }}
                />
              </div>

              <ComposerNetworkTabs resolvedTab={abaAtual} />

              <div
                role="tabpanel"
                id={idDoPainel(abaAtual)}
                aria-labelledby={idDaAba(abaAtual)}
                tabIndex={-1}
                className="outline-none"
              >
                {canalDaAba ? (
                  <ComposerChannelTab
                    channel={canalDaAba}
                    providerInfo={providers.data?.find((p) => p.id === canalDaAba.provider)}
                  />
                ) : (
                  <ComposerGlobalTab />
                )}
              </div>

              <ComposerThread />
            </section>
          </div>

          <ComposerPreviewPane />
        </div>
      </div>

      <ComposerFooter onDone={onDone} onDiscard={() => setConfirmarDescarte(true)} />

      <ComposerDiscardDialog
        open={confirmarDescarte}
        onOpenChange={setConfirmarDescarte}
        onDone={onDone}
      />
    </div>
  );
}
