import type { StateStorage } from 'zustand/middleware';

export type DraftPersistenceStatus = 'idle' | 'saving' | 'saved' | 'failed';

export interface DraftPersistenceSnapshot {
  status: DraftPersistenceStatus;
  revision: number;
}

export interface DraftPersistenceMonitor {
  start: () => number;
  succeed: (revision: number) => void;
  fail: (revision: number) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => DraftPersistenceSnapshot;
}

export function createDraftPersistenceMonitor(): DraftPersistenceMonitor {
  let snapshot: DraftPersistenceSnapshot = { status: 'idle', revision: 0 };
  const listeners = new Set<() => void>();

  const publish = (status: DraftPersistenceStatus, revision: number) => {
    if (revision < snapshot.revision) return;
    snapshot = { status, revision };
    for (const listener of listeners) listener();
  };

  return {
    start: () => {
      const revision = snapshot.revision + 1;
      publish('saving', revision);
      return revision;
    },
    succeed: (revision) => publish('saved', revision),
    fail: (revision) => publish('failed', revision),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
  };
}

/**
 * Observa a conclusão real do storage. Erros de quota/privacidade viram estado de UI,
 * mas não interrompem a digitação nem descartam o estado que ainda vive em memória.
 */
export function trackDraftStorage(
  storage: StateStorage,
  monitor: DraftPersistenceMonitor,
): StateStorage {
  return {
    getItem: (name) => {
      try {
        return storage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      const revision = monitor.start();
      try {
        const result = storage.setItem(name, value);
        if (result instanceof Promise) {
          return result.then(
            () => monitor.succeed(revision),
            () => monitor.fail(revision),
          );
        }
        monitor.succeed(revision);
      } catch {
        monitor.fail(revision);
      }
    },
    removeItem: (name) => {
      try {
        return storage.removeItem(name);
      } catch {
        return;
      }
    },
  };
}

const memory = new Map<string, string>();

/**
 * O mesmo adapter funciona no SSR/teste sem tocar em APIs do navegador. No cliente, qualquer
 * falha real de `localStorage` continua observável pelo monitor em vez de cair num falso sucesso.
 */
export const draftStateStorage: StateStorage = {
  getItem: (name) =>
    typeof window === 'undefined' ? (memory.get(name) ?? null) : window.localStorage.getItem(name),
  setItem: (name, value) => {
    if (typeof window === 'undefined') memory.set(name, value);
    else window.localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') memory.delete(name);
    else window.localStorage.removeItem(name);
  },
};

export const draftPersistenceMonitor = createDraftPersistenceMonitor();
