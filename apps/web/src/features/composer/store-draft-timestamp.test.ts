import { afterEach, describe, expect, test } from 'bun:test';
import { useComposerStore } from './store';

const originalNow = Date.now;

afterEach(() => {
  Date.now = originalNow;
  useComposerStore.getState().reset();
});

describe('timestamp material do rascunho', () => {
  test('remoções de override e mídia atualizam contentUpdatedAt', () => {
    let agora = 100;
    Date.now = () => ++agora;
    useComposerStore.setState({
      overrides: { c1: 'personalizado' },
      mediaIds: ['m1'],
      contentUpdatedAt: 1,
    });

    useComposerStore.getState().clearOverride('c1');
    expect(useComposerStore.getState().contentUpdatedAt).toBe(101);
    useComposerStore.getState().removeMedia('m1');
    expect(useComposerStore.getState().contentUpdatedAt).toBe(102);
  });

  test('estrutura, configuração e mídia de thread atualizam contentUpdatedAt', () => {
    let agora = 200;
    Date.now = () => ++agora;
    useComposerStore.setState({
      channelSettings: {},
      thread: [{ key: 't1', text: '', delaySec: 0, mediaIds: [] }],
      contentUpdatedAt: 1,
    });

    useComposerStore.getState().setChannelSetting('c1', 'title', 'Título');
    expect(useComposerStore.getState().contentUpdatedAt).toBe(201);
    useComposerStore.getState().toggleThreadMedia('t1', 'm1');
    expect(useComposerStore.getState().contentUpdatedAt).toBe(202);
    useComposerStore.getState().setThreadDelay('t1', 30);
    expect(useComposerStore.getState().contentUpdatedAt).toBe(203);
    useComposerStore.getState().removeThreadItem('t1');
    expect(useComposerStore.getState().contentUpdatedAt).toBe(204);
    useComposerStore.getState().addThreadItem();
    expect(useComposerStore.getState().contentUpdatedAt).toBe(205);
  });
});
