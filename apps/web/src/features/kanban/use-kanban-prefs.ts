'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Densidade = 'confortavel' | 'compacta';

interface KanbanPrefs {
  densidade: Densidade;
  setDensidade: (d: Densidade) => void;
}

/**
 * Preferências do quadro que descrevem **a pessoa**, não a visão.
 *
 * Densidade fica aqui e não na URL de propósito: os filtros descrevem o que está sendo olhado e
 * fazem sentido num link compartilhado ("o quadro, filtrado pelas falhas do Instagram desta
 * semana"); densidade descreve como *você* gosta de ler. Mandar um quadro compacto para quem
 * prefere o confortável é uma pequena grosseria sem nenhuma vantagem.
 */
export const useKanbanPrefs = create<KanbanPrefs>()(
  persist(
    (set) => ({
      densidade: 'confortavel',
      setDensidade: (densidade) => set({ densidade }),
    }),
    {
      name: 'mp-kanban-prefs',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
