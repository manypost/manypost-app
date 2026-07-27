'use client';

import { create } from 'zustand';

/**
 * Estado de UI do composer — o que NÃO é rascunho.
 *
 * Mora fora do `useComposerStore` de propósito: aquele é persistido em localStorage e, mais
 * importante, era assinado inteiro pela view. Passar o mouse por um chip de rede escrevia em
 * `previewPeek` e re-renderizava as 788 linhas junto. Separado, um hover custa as duas folhas
 * que realmente leem isto.
 *
 * Nada aqui sobrevive ao fechamento do popup: qual aba estava aberta não é conteúdo.
 */
interface ComposerUiState {
  /** 'global' ou o id do canal em edição */
  activeTab: string;
  /** rede "espiada" no hover do trilho — manda na prévia sem trocar a aba de edição */
  previewPeek: string | null;
  /** no mobile a prévia colapsa; no desktop fica sempre aberta */
  previewOpen: boolean;

  setActiveTab: (tab: string) => void;
  setPreviewPeek: (tab: string | null) => void;
  togglePreview: () => void;
  resetUi: () => void;
}

const INICIAL = { activeTab: 'global', previewPeek: null, previewOpen: true };

export const useComposerUiStore = create<ComposerUiState>()((set) => ({
  ...INICIAL,
  setActiveTab: (activeTab) => set({ activeTab }),
  setPreviewPeek: (previewPeek) => set({ previewPeek }),
  togglePreview: () => set((s) => ({ previewOpen: !s.previewOpen })),
  resetUi: () => set(INICIAL),
}));

/** ações da UI: criadas uma vez dentro do `create`, então a referência nunca muda */
export const useComposerUiActions = () => {
  const setActiveTab = useComposerUiStore((s) => s.setActiveTab);
  const setPreviewPeek = useComposerUiStore((s) => s.setPreviewPeek);
  const togglePreview = useComposerUiStore((s) => s.togglePreview);
  return { setActiveTab, setPreviewPeek, togglePreview };
};
