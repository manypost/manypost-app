import { describe, expect, test } from 'bun:test';
import { makeEmitEvent } from './webhooks';

const noWebhooks = {
  findForEvent: async () => [],
  create: async () => {
    throw new Error('não usado');
  },
  list: async () => [],
  softDelete: async () => true,
  createDelivery: async () => ({ id: 'd-1' }),
  getDelivery: async () => null,
  markDelivery: async () => {},
};

const scheduler = {
  enqueue: async () => 'job-1',
  cancelBySingletonKey: async () => {},
  schedule: async () => {},
};

describe('makeEmitEvent → bus realtime (SSE)', () => {
  test('evento vai ao bus mesmo sem nenhum webhook inscrito', async () => {
    const published: any[] = [];
    const emit = makeEmitEvent({
      webhooks: noWebhooks as any,
      scheduler,
      realtime: { publish: async (orgId, e) => void published.push({ orgId, e }) },
    });
    await emit.emit({ orgId: 'org-1', event: 'post.published', data: { groupId: 'g1' } });
    expect(published).toEqual([
      { orgId: 'org-1', e: { type: 'post.published', data: { groupId: 'g1' } } },
    ]);
  });

  test('falha do bus não derruba o emit (melhor esforço — polling cobre)', async () => {
    const emit = makeEmitEvent({
      webhooks: noWebhooks as any,
      scheduler,
      realtime: {
        publish: async () => {
          throw new Error('redis fora');
        },
      },
    });
    await expect(
      emit.emit({ orgId: 'org-1', event: 'post.failed', data: {} }),
    ).resolves.toBeUndefined();
  });
});
