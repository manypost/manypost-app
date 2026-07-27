'use client';

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useComposerActions,
  useComposerChannelIds,
  useComposerEditorNonce,
  useComposerMediaIds,
} from './composer-selectors';
import { ComposerEditorCard } from './composer-editor-card';
import { useComposerStore } from './store';
import { MediaStrip } from './media-picker';
import { canaisHerdandoGlobal } from './validation';
import { useCanaisSelecionados } from './use-composer-validation';

/**
 * Aba global: o texto que vale para todo canal sem texto próprio.
 *
 * Quando ela está vazia E todo canal escolhido tem texto próprio, o post está completo — a
 * regra nova. Nesse caso a caixa diz que não está em uso, em vez de parecer um campo por
 * preencher; era esse "vazio acusador" que fazia a pessoa achar que faltava algo (e a versão
 * anterior, de fato, travava os dois CTAs).
 */
export function ComposerGlobalTab() {
  const t = useTranslations('composer');
  const { setText, toggleMedia, removeMedia } = useComposerActions();
  const mediaIds = useComposerMediaIds();
  const channelIds = useComposerChannelIds();
  const editorNonce = useComposerEditorNonce();
  const selected = useCanaisSelecionados();

  // seletores BOOLEANO/NUMÉRICO de propósito: assinar `text` faria esta aba (e o editor dentro
  // dela) re-renderizar a cada tecla, que é exatamente o que a decomposição veio evitar
  const vazio = useComposerStore((s) => s.text.trim().length === 0);
  const herdando = useComposerStore((s) => canaisHerdandoGlobal(selected, s.overrides).length);
  const naoUsado = vazio && selected.length > 0 && herdando === 0;

  return (
    <div className="flex flex-col gap-3">
      <ComposerEditorCard
        key={`global-${editorNonce}`}
        escopo={{ kind: 'global' }}
        // leitura imperativa: o editor é não-controlado e só usa isto no mount. Assinar `text`
        // aqui daria o re-render por tecla que os seletores acima evitam; o `key` com o
        // `editorNonce` garante que uma escrita externa (rascunho de IA) remonte com o novo texto
        initialText={useComposerStore.getState().text}
        onChange={setText}
        label={t('editorLabel')}
        autoFocus
        aiChannelIds={channelIds}
        media={{ selectedIds: mediaIds, onToggle: toggleMedia }}
        cabecalho={
          naoUsado ? (
            <div className="flex items-start gap-2 border-b border-line bg-surface-2/60 px-3 py-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-graphite" aria-hidden />
              <p className="text-[11px] leading-relaxed text-graphite">
                <span className="font-semibold text-ink">{t('globalTab.unusedTitle')}</span>{' '}
                {t('globalTab.unusedBody')}
              </p>
            </div>
          ) : null
        }
      />
      <MediaStrip mediaIds={mediaIds} onRemove={removeMedia} />
    </div>
  );
}
