'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Estado do composer (SPEC_FRONTEND §3.3): Zustand com persist = autosave do
 * rascunho em localStorage — fechar/reabrir ou dar F5 não perde conteúdo.
 * `editorNonce` força o remount dos editores TipTap (não-controlados) quando o
 * rascunho é descartado.
 */
export type ScheduleMode = 'now' | 'schedule';

interface ComposerState {
  text: string;
  channelIds: string[];
  /** override do texto por canal (chave = channelId) — só os personalizados */
  overrides: Record<string, string>;
  mode: ScheduleMode;
  /** valor cru do input datetime-local (horário local do usuário) */
  publishAtLocal: string;
  requireApproval: boolean;
  editorNonce: number;

  setText: (text: string) => void;
  toggleChannel: (id: string) => void;
  setOverride: (id: string, text: string) => void;
  clearOverride: (id: string) => void;
  setMode: (mode: ScheduleMode) => void;
  setPublishAtLocal: (value: string) => void;
  setRequireApproval: (value: boolean) => void;
  reset: () => void;
}

const EMPTY = {
  text: '',
  channelIds: [] as string[],
  overrides: {} as Record<string, string>,
  mode: 'schedule' as ScheduleMode,
  publishAtLocal: '',
  requireApproval: false,
};

export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      ...EMPTY,
      editorNonce: 0,

      setText: (text) => set({ text }),
      toggleChannel: (id) =>
        set((s) => {
          if (s.channelIds.includes(id)) {
            const { [id]: _, ...overrides } = s.overrides;
            return { channelIds: s.channelIds.filter((c) => c !== id), overrides };
          }
          return { channelIds: [...s.channelIds, id] };
        }),
      setOverride: (id, text) => set((s) => ({ overrides: { ...s.overrides, [id]: text } })),
      clearOverride: (id) =>
        set((s) => {
          const { [id]: _, ...overrides } = s.overrides;
          return { overrides };
        }),
      setMode: (mode) => set({ mode }),
      setPublishAtLocal: (publishAtLocal) => set({ publishAtLocal }),
      setRequireApproval: (requireApproval) => set({ requireApproval }),
      reset: () => set((s) => ({ ...EMPTY, editorNonce: s.editorNonce + 1 })),
    }),
    { name: 'mp-composer-draft' },
  ),
);
