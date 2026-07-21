'use client';

import { create } from 'zustand';

/**
 * Abre/fecha o composer como popup global (montado no layout autenticado).
 * NÃO persiste — o rascunho em si vive em `useComposerStore` (persist). Quem
 * quer pré-preencher (duplicar, "+" do calendário) atualiza o rascunho ANTES
 * de chamar `openComposer`.
 */
interface ComposerModalState {
  open: boolean;
  openComposer: () => void;
  setOpen: (open: boolean) => void;
}

export const useComposerModal = create<ComposerModalState>((set) => ({
  open: false,
  openComposer: () => set({ open: true }),
  setOpen: (open) => set({ open }),
}));
