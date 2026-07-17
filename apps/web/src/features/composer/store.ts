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

export interface ThreadItemDraft {
  /** chave local estável p/ React/remount — não vai pra API */
  key: string;
  text: string;
  delaySec: number;
  mediaIds: string[];
}

interface ComposerState {
  text: string;
  channelIds: string[];
  /** override do texto por canal (chave = channelId) — só os personalizados */
  overrides: Record<string, string>;
  /** settings de publicação por canal (settingsByChannel do POST /v1/posts) — só os alterados */
  channelSettings: Record<string, Record<string, unknown>>;
  /** mídia do post principal (ids da biblioteca) */
  mediaIds: string[];
  /** réplicas encadeadas (item 0 é o post principal, não entra aqui) */
  thread: ThreadItemDraft[];
  mode: ScheduleMode;
  /** valor cru do input datetime-local (horário local do usuário) */
  publishAtLocal: string;
  requireApproval: boolean;
  editorNonce: number;

  setText: (text: string) => void;
  toggleChannel: (id: string) => void;
  setOverride: (id: string, text: string) => void;
  clearOverride: (id: string) => void;
  /** value undefined = volta ao padrão da rede (remove a chave) */
  setChannelSetting: (id: string, key: string, value: unknown) => void;
  toggleMedia: (id: string) => void;
  removeMedia: (id: string) => void;
  addThreadItem: () => void;
  setThreadText: (key: string, text: string) => void;
  setThreadDelay: (key: string, delaySec: number) => void;
  toggleThreadMedia: (key: string, mediaId: string) => void;
  removeThreadItem: (key: string) => void;
  setMode: (mode: ScheduleMode) => void;
  setPublishAtLocal: (value: string) => void;
  setRequireApproval: (value: boolean) => void;
  reset: () => void;
}

const EMPTY = {
  text: '',
  channelIds: [] as string[],
  overrides: {} as Record<string, string>,
  channelSettings: {} as Record<string, Record<string, unknown>>,
  mediaIds: [] as string[],
  thread: [] as ThreadItemDraft[],
  mode: 'schedule' as ScheduleMode,
  publishAtLocal: '',
  requireApproval: false,
};

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

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
            const { [id]: __, ...channelSettings } = s.channelSettings;
            return { channelIds: s.channelIds.filter((c) => c !== id), overrides, channelSettings };
          }
          return { channelIds: [...s.channelIds, id] };
        }),
      setOverride: (id, text) => set((s) => ({ overrides: { ...s.overrides, [id]: text } })),
      setChannelSetting: (id, key, value) =>
        set((s) => {
          const current = { ...(s.channelSettings[id] ?? {}) };
          if (value === undefined) delete current[key];
          else current[key] = value;
          const channelSettings = { ...s.channelSettings };
          if (Object.keys(current).length === 0) delete channelSettings[id];
          else channelSettings[id] = current;
          return { channelSettings };
        }),
      clearOverride: (id) =>
        set((s) => {
          const { [id]: _, ...overrides } = s.overrides;
          return { overrides };
        }),
      toggleMedia: (id) =>
        set((s) => ({
          mediaIds: s.mediaIds.includes(id)
            ? s.mediaIds.filter((m) => m !== id)
            : [...s.mediaIds, id],
        })),
      removeMedia: (id) => set((s) => ({ mediaIds: s.mediaIds.filter((m) => m !== id) })),
      addThreadItem: () =>
        set((s) => ({
          thread: [...s.thread, { key: newKey(), text: '', delaySec: 0, mediaIds: [] }],
        })),
      setThreadText: (key, text) =>
        set((s) => ({
          thread: s.thread.map((item) => (item.key === key ? { ...item, text } : item)),
        })),
      setThreadDelay: (key, delaySec) =>
        set((s) => ({
          thread: s.thread.map((item) => (item.key === key ? { ...item, delaySec } : item)),
        })),
      toggleThreadMedia: (key, mediaId) =>
        set((s) => ({
          thread: s.thread.map((item) =>
            item.key === key
              ? {
                  ...item,
                  mediaIds: item.mediaIds.includes(mediaId)
                    ? item.mediaIds.filter((m) => m !== mediaId)
                    : [...item.mediaIds, mediaId],
                }
              : item,
          ),
        })),
      removeThreadItem: (key) =>
        set((s) => ({ thread: s.thread.filter((item) => item.key !== key) })),
      setMode: (mode) => set({ mode }),
      setPublishAtLocal: (publishAtLocal) => set({ publishAtLocal }),
      setRequireApproval: (requireApproval) => set({ requireApproval }),
      reset: () => set((s) => ({ ...EMPTY, editorNonce: s.editorNonce + 1 })),
    }),
    { name: 'mp-composer-draft' },
  ),
);
