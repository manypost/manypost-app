'use client';

import { ClipboardCopy, Lock, LockOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { components } from '@/lib/api/schema';
import { ChannelSettingsCard } from './channel-settings';
import { ComposerEditorCard } from './composer-editor-card';
import {
  useComposerActions,
  useComposerEditorNonce,
  useComposerOverride,
  useComposerText,
} from './composer-selectors';
import { useComposerStore } from './store';

type ProviderInfo = components['schemas']['ChannelProviderInfo'];
type Channel = components['schemas']['Channel'];

/**
 * Aba de um canal: ou ele herda o texto global, ou tem o seu.
 *
 * Herdando, a aba MOSTRA o texto que vai publicar em vez do bloco vazio de 240px que só dizia
 * "edição global ativa" — a pergunta de quem abre a aba de um canal é "o que sai aqui?", e a
 * resposta estava escondida em outra aba.
 *
 * Personalizado, sobra a saída óbvia (voltar ao global) e a que faltava: copiar o texto global
 * para partir dele em vez de reescrever do zero.
 */
export function ComposerChannelTab({
  channel,
  providerInfo,
}: {
  channel: Channel;
  providerInfo: ProviderInfo | undefined;
}) {
  const t = useTranslations('composer');
  const { setOverride, clearOverride, setChannelSetting, bumpEditors } = useComposerActions();
  const override = useComposerOverride(channel.id);
  const editorNonce = useComposerEditorNonce();
  const settings = useComposerStore((s) => s.channelSettings[channel.id]);

  const nome = channel.name ?? channel.username ?? channel.id;
  const personalizado = override !== undefined;

  const cartaoDeSettings = providerInfo ? (
    <ChannelSettingsCard
      channelId={channel.id}
      providerId={providerInfo.id}
      providerName={providerInfo.name}
      channelName={nome}
      schema={providerInfo.settingsSchema}
      values={settings ?? {}}
      onChange={(key, value) => setChannelSetting(channel.id, key, value)}
    />
  ) : null;

  if (!personalizado) {
    return (
      <div className="flex flex-col gap-3">
        <TextoHerdado channel={channel} />
        {cartaoDeSettings}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ComposerEditorCard
        key={`${channel.id}-${editorNonce}`}
        escopo={{ kind: 'channel', channelId: channel.id }}
        initialText={useComposerStore.getState().overrides[channel.id] ?? ''}
        onChange={(text) => setOverride(channel.id, text)}
        label={t('channelEditorLabel', { name: nome })}
        aiChannelIds={[channel.id]}
        cabecalho={
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-surface-2/60 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <LockOpen className="size-3.5 text-accent" aria-hidden />
              {t('channelTab.customizing', { name: nome })}
            </span>
            {/* wrap também aqui: os dois rótulos somam ~300px e num aparelho de 320px eles
                precisam poder cair um sob o outro em vez de vazar do cartão */}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                // remonta o editor para o texto copiado aparecer: ele é não-controlado
                onClick={() => {
                  setOverride(channel.id, useComposerStore.getState().text);
                  bumpEditors();
                }}
                className="h-6 gap-1 px-2 text-[11px] font-semibold text-graphite hover:bg-surface hover:text-ink"
              >
                <ClipboardCopy className="size-3" aria-hidden />
                {t('channelTab.copyGlobal')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => clearOverride(channel.id)}
                className="h-6 gap-1 px-2 text-[11px] font-semibold text-graphite hover:bg-surface hover:text-ink"
              >
                <Lock className="size-3" aria-hidden />
                {t('channelTab.useGlobal')}
              </Button>
            </div>
          </div>
        }
      />
      {cartaoDeSettings}
    </div>
  );
}

/** painel de herança: o texto global em leitura, com a saída para personalizar */
function TextoHerdado({ channel }: { channel: Channel }) {
  const t = useTranslations('composer');
  const { setOverride } = useComposerActions();
  const text = useComposerText();
  const vazio = text.trim().length === 0;

  return (
    <div className="bevel-surface flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Lock className="size-3.5 text-graphite" aria-hidden />
          {t('channelTab.inheriting')}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOverride(channel.id, text)}
          className="ml-auto gap-1.5"
        >
          <LockOpen className="size-3.5" aria-hidden />
          {t('channelTab.customize')}
        </Button>
      </div>
      {vazio ? (
        <p className="text-xs leading-relaxed text-graphite">{t('channelTab.inheritingEmpty')}</p>
      ) : (
        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-graphite">
          {text}
        </p>
      )}
    </div>
  );
}
