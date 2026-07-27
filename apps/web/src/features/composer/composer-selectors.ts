'use client';

import { useShallow } from 'zustand/react/shallow';
import { type ComposerState, useComposerStore } from './store';
import type { IssueScope } from './validation';

/**
 * Assinaturas finas do store do composer.
 *
 * A view assinava o store inteiro (`useComposerStore()` sem seletor), então cada tecla
 * re-renderizava tudo — inclusive as prévias por rede, que são a parte cara. Aqui cada folha
 * assina só o campo que lê.
 *
 * O `useShallow` é obrigatório no zustand@5 para seletor que devolve objeto novo: sem ele, o
 * `Object.is` do React vê referência diferente a cada render e entra em loop. As ações são
 * criadas uma vez dentro do `create()` e nunca substituídas, então este objeto é
 * shallow-estável para sempre (garantido em `composer-selectors.test.ts`).
 */

export type ComposerActions = Pick<
  ComposerState,
  | 'setText'
  | 'toggleChannel'
  | 'setOverride'
  | 'clearOverride'
  | 'setChannelSetting'
  | 'toggleMedia'
  | 'removeMedia'
  | 'addThreadItem'
  | 'setThreadText'
  | 'setThreadDelay'
  | 'toggleThreadMedia'
  | 'removeThreadItem'
  | 'setPublishAtLocal'
  | 'setRequireApproval'
  | 'bumpEditors'
  | 'reset'
>;

/** exportado à parte para o teste conferir a estabilidade sem montar React */
export const selectComposerActions = (s: ComposerState): ComposerActions => ({
  setText: s.setText,
  toggleChannel: s.toggleChannel,
  setOverride: s.setOverride,
  clearOverride: s.clearOverride,
  setChannelSetting: s.setChannelSetting,
  toggleMedia: s.toggleMedia,
  removeMedia: s.removeMedia,
  addThreadItem: s.addThreadItem,
  setThreadText: s.setThreadText,
  setThreadDelay: s.setThreadDelay,
  toggleThreadMedia: s.toggleThreadMedia,
  removeThreadItem: s.removeThreadItem,
  setPublishAtLocal: s.setPublishAtLocal,
  setRequireApproval: s.setRequireApproval,
  bumpEditors: s.bumpEditors,
  reset: s.reset,
});

export const useComposerActions = (): ComposerActions =>
  useComposerStore(useShallow(selectComposerActions));

export const useComposerText = () => useComposerStore((s) => s.text);
export const useComposerOverrides = () => useComposerStore((s) => s.overrides);
export const useComposerThread = () => useComposerStore((s) => s.thread);
export const useComposerMediaIds = () => useComposerStore((s) => s.mediaIds);
export const useComposerChannelIds = () => useComposerStore((s) => s.channelIds);
export const useComposerChannelSettings = () => useComposerStore((s) => s.channelSettings);
export const useComposerEditorNonce = () => useComposerStore((s) => s.editorNonce);
export const useComposerPublishAtLocal = () => useComposerStore((s) => s.publishAtLocal);
export const useComposerRequireApproval = () => useComposerStore((s) => s.requireApproval);

/** override de um canal — `undefined` = herda o global (a distinção que a validação usa) */
export const useComposerOverride = (channelId: string) =>
  useComposerStore((s) => s.overrides[channelId]);

/**
 * Texto que um editor está de fato editando. Assinado só por quem PRECISA do texto vivo (as
 * ações de IA e o contador) — o editor em si é não-controlado e não lê daqui.
 */
export const useTextoDoEscopo = (escopo: IssueScope): string =>
  useComposerStore((s) => {
    if (escopo.kind === 'channel') return s.overrides[escopo.channelId] ?? s.text;
    if (escopo.kind === 'thread') {
      return s.thread.find((item) => item.key === escopo.threadKey)?.text ?? '';
    }
    return s.text;
  });
