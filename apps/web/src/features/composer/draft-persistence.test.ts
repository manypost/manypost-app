import { describe, expect, test } from 'bun:test';
import type { StateStorage } from 'zustand/middleware';
import {
  createDraftPersistenceMonitor,
  trackDraftStorage,
} from './draft-persistence';

describe('persistência do rascunho', () => {
  test('só confirma depois que a escrita síncrona termina', () => {
    const monitor = createDraftPersistenceMonitor();
    const estados: string[] = [];
    monitor.subscribe(() => estados.push(monitor.getSnapshot().status));
    const storage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        expect(monitor.getSnapshot().status).toBe('saving');
      },
      removeItem: () => {},
    };

    trackDraftStorage(storage, monitor).setItem('draft', '{}');

    expect(estados).toEqual(['saving', 'saved']);
    expect(monitor.getSnapshot().status).toBe('saved');
  });

  test('espera uma escrita assíncrona antes de confirmar', async () => {
    const monitor = createDraftPersistenceMonitor();
    let liberar!: () => void;
    const storage: StateStorage = {
      getItem: () => null,
      setItem: () => new Promise<void>((resolve) => (liberar = resolve)),
      removeItem: () => {},
    };

    const escrita = trackDraftStorage(storage, monitor).setItem('draft', '{}');
    expect(monitor.getSnapshot().status).toBe('saving');

    liberar();
    await escrita;
    expect(monitor.getSnapshot().status).toBe('saved');
  });

  test('expõe falha sem interromper a edição', () => {
    const monitor = createDraftPersistenceMonitor();
    const storage: StateStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
      removeItem: () => {},
    };

    expect(() => trackDraftStorage(storage, monitor).setItem('draft', '{}')).not.toThrow();
    expect(monitor.getSnapshot().status).toBe('failed');
  });

  test('uma escrita antiga não sobrescreve o resultado da mais nova', () => {
    const monitor = createDraftPersistenceMonitor();
    const antiga = monitor.start();
    const nova = monitor.start();

    monitor.succeed(nova);
    monitor.fail(antiga);

    expect(monitor.getSnapshot()).toEqual({ status: 'saved', revision: nova });
  });
});
