'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { memo, useDeferredValue } from 'react';
import { cn } from '@/lib/utils';
import {
  useComposerChannelSettings,
  useComposerMediaIds,
  useComposerOverrides,
  useComposerPublishAtLocal,
  useComposerText,
  useComposerThread,
} from './composer-selectors';
import { useComposerUiStore } from './composer-ui-store';
import { PostPreview } from './post-preview';
import { useCanaisSelecionados } from './use-composer-validation';

/**
 * Prévia ao vivo — a parte cara da tela (um cartão que imita o layout da rede).
 *
 * Duas defesas: `useDeferredValue` no texto, para a digitação nunca esperar o redesenho da
 * prévia; e `memo` no cartão, para o redesenho só acontecer quando o conteúdo mudou de fato —
 * passar o mouse pelo trilho, por exemplo, muda a rede exibida mas não o texto.
 */
export function ComposerPreviewPane() {
  const t = useTranslations('composer');
  const previewOpen = useComposerUiStore((s) => s.previewOpen);
  const previewPeek = useComposerUiStore((s) => s.previewPeek);
  const activeTab = useComposerUiStore((s) => s.activeTab);
  const togglePreview = useComposerUiStore((s) => s.togglePreview);

  const selected = useCanaisSelecionados();
  const resolvida =
    activeTab === 'global' || selected.some((ch) => ch.id === activeTab) ? activeTab : 'global';
  // o hover ESPIA a rede sem trocar a aba de edição; sem hover, segue a aba
  const atual = previewPeek ?? resolvida;
  const canal = selected.find((ch) => ch.id === atual);
  const nome =
    atual === 'global' ? t('preview.globalCard') : (canal?.name ?? canal?.username ?? '');

  return (
    <aside className="flex flex-col self-start border-t border-line pt-6 lg:sticky lg:top-0 lg:border-l lg:border-t-0 lg:border-line lg:pl-6 lg:pt-0">
      {/* no mobile o cabeçalho colapsa a prévia (ela fica no fim da coluna única); no desktop é
          só rótulo — o botão vira inerte e a prévia fica sempre aberta */}
      <button
        type="button"
        onClick={togglePreview}
        aria-expanded={previewOpen}
        className="mb-2.5 flex w-full cursor-pointer items-center gap-2 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:pointer-events-none"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-graphite">
          {t('preview.title')}
        </span>
        {nome ? (
          <span className="min-w-0 flex-1 truncate text-left text-xs font-medium text-mist lg:flex-none">
            {nome}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden
          className={cn(
            'ml-auto size-4 shrink-0 text-mist transition-transform duration-200 lg:hidden',
            previewOpen && 'rotate-180',
          )}
        />
      </button>
      <div className={cn('lg:block', !previewOpen && 'hidden')}>
        <PreviewConteudo atual={atual} />
      </div>
    </aside>
  );
}

/**
 * A prop é só a rede exibida (uma string), de propósito: passar a lista de canais quebraria o
 * `memo` a cada render, porque ela é filtrada de novo toda vez.
 */
const PreviewConteudo = memo(function PreviewConteudo({ atual }: { atual: string }) {
  const selected = useCanaisSelecionados();
  const text = useDeferredValue(useComposerText());
  const overrides = useDeferredValue(useComposerOverrides());
  const thread = useDeferredValue(useComposerThread());
  const mediaIds = useComposerMediaIds();
  const channelSettings = useComposerChannelSettings();
  const publishAtLocal = useComposerPublishAtLocal();

  const publishAt = publishAtLocal ? new Date(publishAtLocal) : null;

  return (
    <PostPreview
      current={atual}
      channels={selected}
      globalText={text}
      textFor={(channelId) => overrides[channelId] ?? text}
      settingsFor={(channelId) => channelSettings[channelId] ?? {}}
      mediaIds={mediaIds}
      thread={thread.map((item) => ({ text: item.text, mediaIds: item.mediaIds }))}
      publishAt={publishAt}
    />
  );
});
