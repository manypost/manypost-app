'use client';

import { create } from 'zustand';

/**
 * Estado de UI do modal de criação (separado do rascunho persistido em `useComposerStore`):
 * o composer virou um popup grande aberto sobre a página atual (calendário/kanban) em vez
 * de uma rota. NÃO é persistido — só o rascunho sobrevive a F5.
 */
interface ComposerModalState {
  open: boolean;
  openComposer: () => void;
  closeComposer: () => void;
}

export const useComposerModal = create<ComposerModalState>((set) => ({
  open: false,
  openComposer: () => set({ open: true }),
  closeComposer: () => set({ open: false }),
}));
