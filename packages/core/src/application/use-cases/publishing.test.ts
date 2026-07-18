import { beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { ChannelProvider, PublicationState } from '@manypost/contracts';
import { AesGcmCryptoService } from '../../infra/crypto/aes-gcm.service';
import type { ChannelRecord, PublicationView } from '../ports/publishing';
import { channelAad, makeConnectChannel } from './channels';
import {
  makeCancelPost,
  makeContinueThread,
  makePublishPublication,
  makeRecoverDue,
  makeReschedulePost,
  makeRetryPost,
  makeSchedulePost,
} from './publishing';

const crypto = AesGcmCryptoService.fromHex('b'.repeat(64));

// ------- provider fake controlável -------
function makeProvider(behavior: {
  failFirst?: number;
  expireToken?: boolean;
  reject?: boolean;
  failReplyFirst?: number;
  noThreads?: boolean;
}) {
  let calls = 0;
  let replyCalls = 0;
  let lastItems: any[] = [];
  const replies: Array<{ parent: string; content: string }> = [];
  const provider: ChannelProvider = {
    id: 'fake',
    name: 'Fake',
    capabilities: {
      editor: 'plain',
      maxLength: () => 50,
      media: { images: { maxCount: 4, mimeTypes: [] }, videos: { maxCount: 1, mimeTypes: [] } },
      get threads() {
        return !behavior.noThreads;
      },
      mentions: false,
      analytics: false,
      twoStepConnect: false,
      customInstance: false,
    },
    rateDefaults: { maxConcurrent: 2, perChannelWindow: { limit: 10, windowSec: 60 } },
    settingsSchema: z.object({ tag: z.string().optional() }),
    async getAuthUrl() {
      return { url: 'http://fake', state: 's' };
    },
    async exchangeCode() {
      return {
        accessToken: 'tok-1',
        refreshToken: 'ref-1',
        scopes: [],
        externalId: 'ext-1',
        name: 'Conta Fake',
      };
    },
    async refreshToken() {
      behavior.expireToken = false; // token novo passa a valer
      return { accessToken: 'tok-2', scopes: [] };
    },
    async publish(_ctx, _token, items) {
      calls++;
      lastItems = items;
      if (behavior.expireToken) throw { status: 401, body: 'expired' };
      if (behavior.reject) throw { status: 422, body: 'rejected' };
      if (behavior.failFirst && calls <= behavior.failFirst) throw { status: 500, body: 'flaky' };
      return [{ externalId: `ext-post-${calls}`, releaseUrl: 'https://fake/p/1' }];
    },
    async publishReply(_ctx, _token, parentExternalId, item) {
      replyCalls++;
      if (behavior.expireToken) throw { status: 401, body: 'expired' };
      if (behavior.failReplyFirst && replyCalls <= behavior.failReplyFirst) {
        throw { status: 500, body: 'flaky reply' };
      }
      replies.push({ parent: parentExternalId, content: item.content });
      return { externalId: `ext-reply-${replyCalls}`, releaseUrl: `https://fake/r/${replyCalls}` };
    },
    async validateMedia(items) {
      return items.some((i) => i.media.length > 4)
        ? { ok: false as const, reason: 'máximo de 4 mídias' }
        : { ok: true as const };
    },
    classifyError(status) {
      if (status === 401) return 'refresh-token';
      if (status === 429 || status >= 500) return 'transient';
      return 'permanent';
    },
  };
  return {
    provider,
    callCount: () => calls,
    lastItems: () => lastItems,
    replyCount: () => replyCalls,
    replies: () => replies,
  };
}

// ------- fakes de repositório -------
function makeFakes(provider: ChannelProvider) {
  let seq = 0;
  const id = () => `id-${++seq}`;
  const channels: ChannelRecord[] = [];
  const groups: { id: string; orgId: string; state: string }[] = [];
  const pubs: (PublicationView & { attemptId?: string })[] = [];
  const events: { pubId: string; from: string | null; to: string }[] = [];
  const jobs: { queue: string; payload: any; opts: any }[] = [];
  const mediaRecords: any[] = [];
  const pubItems: any[] = [];

  const deps = {
    crypto,
    registry: { get: (pid: string) => (pid === provider.id ? provider : undefined), list: () => [provider] },
    scheduler: {
      enqueue: async (queue: string, payload: any, opts: any) => {
        jobs.push({ queue, payload, opts });
        return `job-${jobs.length}`;
      },
      cancelBySingletonKey: async () => {},
      schedule: async () => {},
    },
    channels: {
      upsert: async (d: any) => {
        const existing = channels.find(
          (c) => c.orgId === d.orgId && c.provider === d.provider && c.externalId === d.externalId,
        );
        if (existing) {
          Object.assign(existing, d);
          return existing;
        }
        const c = { id: id(), status: 'ACTIVE', ...d };
        channels.push(c);
        return c;
      },
      list: async (orgId: string) => channels.filter((c) => c.orgId === orgId),
      findMany: async (orgId: string, ids: string[]) =>
        channels.filter((c) => c.orgId === orgId && ids.includes(c.id)),
      updateTokens: async (cid: string, d: any) => {
        const c = channels.find((x) => x.id === cid)!;
        Object.assign(c, d);
      },
      setStatus: async (cid: string, status: any) => {
        const c = channels.find((x) => x.id === cid)!;
        c.status = status;
      },
      softDelete: async () => true,
    },
    publishing: {
      createGroup: async (d: any) => {
        const g = { id: id(), orgId: d.orgId, state: 'SCHEDULED' };
        groups.push(g);
        const created = d.publications.map((p: any) => {
          const pub: PublicationView = {
            id: id(),
            orgId: d.orgId,
            groupId: g.id,
            channelId: p.channelId,
            state: 'SCHEDULED',
            publishAt: d.publishAt,
            content: p.content,
            settings: p.settings,
            attemptCount: 0,
            jobVersion: 0,
            lastPublishedIndex: -1,
            externalId: null,
            releaseUrl: null,
            errorClass: null,
            errorMessage: null,
          };
          pubs.push(pub);
          for (const [position, item] of (p.items ?? []).entries()) {
            pubItems.push({
              id: id(),
              publicationId: pub.id,
              position,
              content: item.content,
              media: item.media,
              delaySec: item.delaySec,
              externalId: null,
            });
          }
          return { id: pub.id, channelId: p.channelId };
        });
        return { groupId: g.id, publications: created };
      },
      listItems: async (pid: string) =>
        pubItems
          .filter((x) => x.publicationId === pid)
          .sort((a, b) => a.position - b.position),
      recordItemPublished: async (pid: string, itemId: string, position: number, d: any) => {
        const item = pubItems.find((x) => x.id === itemId)!;
        item.externalId = d.externalId;
        const pub = pubs.find((x) => x.id === pid)!;
        if (pub.lastPublishedIndex === position - 1) pub.lastPublishedIndex = position;
        if (position === 0) {
          pub.externalId = d.externalId;
          if (d.releaseUrl !== undefined) pub.releaseUrl = d.releaseUrl;
        }
      },
      getGroup: async (orgId: string, gid: string) => {
        const g = groups.find((x) => x.id === gid && x.orgId === orgId);
        if (!g) return null;
        return {
          id: g.id,
          state: g.state as any,
          publishAt: null,
          baseContent: {},
          publications: pubs.filter((p) => p.groupId === gid),
        };
      },
      findForPublish: async (pid: string) => {
        const publication = pubs.find((p) => p.id === pid);
        if (!publication) return null;
        return { publication: { ...publication }, channel: channels.find((c) => c.id === publication.channelId)! };
      },
      transition: async (pid: string, from: PublicationState[], to: PublicationState, patch?: any) => {
        const p = pubs.find((x) => x.id === pid)!;
        if (!from.includes(p.state)) return false;
        events.push({ pubId: pid, from: p.state, to });
        p.state = to;
        if (patch?.incrementAttempt) p.attemptCount++;
        if (patch?.resetAttempts) p.attemptCount = 0;
        if (patch?.bumpJobVersion) p.jobVersion++;
        if (patch?.externalId !== undefined) p.externalId = patch.externalId;
        if (patch?.releaseUrl !== undefined) p.releaseUrl = patch.releaseUrl;
        if (patch?.errorClass !== undefined) p.errorClass = patch.errorClass;
        if (patch?.errorMessage !== undefined) p.errorMessage = patch.errorMessage;
        return true;
      },
      listDue: async (before: Date) =>
        pubs
          .filter((p) => p.state === 'SCHEDULED' && p.publishAt && p.publishAt <= before)
          .map((p) => ({ id: p.id, jobVersion: p.jobVersion })),
      listStuck: async () => [],
      rescheduleGroup: async (orgId: string, gid: string, d: any) => {
        return pubs
          .filter(
            (p) =>
              p.groupId === gid &&
              p.orgId === orgId &&
              ['SCHEDULED', 'RETRYING', 'TOKEN_REFRESH'].includes(p.state),
          )
          .map((p) => {
            p.state = 'SCHEDULED';
            p.attemptCount = 0;
            p.jobVersion++;
            if (d.baseContent) p.content = d.baseContent;
            if (d.publishAt) p.publishAt = d.publishAt;
            if (d.settingsByChannel?.[p.channelId]) {
              p.settings = { ...((p.settings as object) ?? {}), ...d.settingsByChannel[p.channelId] };
            }
            return { id: p.id, channelId: p.channelId, jobVersion: p.jobVersion, publishAt: p.publishAt! };
          });
      },
      refreshGroupState: async (gid: string) => {
        const list = pubs.filter((p) => p.groupId === gid);
        const g = groups.find((x) => x.id === gid)!;
        if (list.every((p) => p.state === 'PUBLISHED')) g.state = 'DONE';
        else if (list.every((p) => !['SCHEDULED', 'PUBLISHING', 'RETRYING', 'TOKEN_REFRESH'].includes(p.state)))
          g.state = 'PARTIAL';
      },
    },
    media: {
      create: async () => {
        throw new Error('não usado aqui');
      },
      list: async () => mediaRecords,
      findMany: async (orgId: string, ids: string[]) =>
        mediaRecords.filter((m) => m.orgId === orgId && ids.includes(m.id)),
      setAlt: async () => true,
      softDelete: async () => true,
    },
    storage: {
      put: async () => {},
      read: async () => null,
      delete: async () => {},
      publicUrl: (key: string) => `https://mp.test/uploads/${key}`,
    },
    _state: { channels, pubs, events, jobs, groups, mediaRecords, pubItems },
  };
  return deps;
}

async function connect(deps: any, provider: ChannelProvider, orgId = 'org-1') {
  const account = await provider.exchangeCode({} as any, { code: 'x', redirectUri: 'r' });
  return makeConnectChannel(deps)({ orgId, provider, account });
}

let behavior: {
  failFirst?: number;
  expireToken?: boolean;
  reject?: boolean;
  failReplyFirst?: number;
  noThreads?: boolean;
};
let prov: ReturnType<typeof makeProvider>;
let f: ReturnType<typeof makeFakes>;

beforeEach(() => {
  behavior = {};
  prov = makeProvider(behavior);
  f = makeFakes(prov.provider);
});

const schedule = (over: any = {}) =>
  makeSchedulePost(f as any)({
    orgId: 'org-1',
    authorId: 'u1',
    text: 'olá mundo',
    channelIds: [f._state.channels[0]!.id],
    publishAt: new Date(Date.now() - 1000),
    ...over,
  });

const publish = (pid: string) =>
  makePublishPublication({ ...(f as any), retryBaseSec: 0.001 })(pid);

describe('conectar canal', () => {
  test('tokens são cifrados at-rest e nunca aparecem no retorno', async () => {
    const ch = await connect(f, prov.provider);
    expect((ch as any).tokenEnc).toBeUndefined();
    const raw = f._state.channels[0]!;
    expect(Buffer.from(raw.tokenEnc).includes(Buffer.from('tok-1'))).toBe(false);
    const aad = channelAad('org-1', 'fake', 'ext-1');
    expect(await crypto.decrypt(raw.tokenEnc, aad, raw.tokenKeyVersion)).toBe('tok-1');
  });

  test('reconectar a mesma conta atualiza em vez de duplicar', async () => {
    await connect(f, prov.provider);
    await connect(f, prov.provider);
    expect(f._state.channels).toHaveLength(1);
  });
});

describe('schedulePost', () => {
  beforeEach(async () => {
    await connect(f, prov.provider);
  });

  test('cria grupo + 1 publicação por canal + job com singletonKey', async () => {
    const group = await schedule();
    expect(group!.publications).toHaveLength(1);
    expect(group!.publications[0]!.state).toBe('SCHEDULED');
    expect(f._state.jobs[0]).toMatchObject({
      queue: 'publish',
      opts: { singletonKey: group!.publications[0]!.id },
    });
  });

  test('valida: texto vazio, sem canais, canal de outra org, texto longo', async () => {
    await expect(schedule({ text: '  ' })).rejects.toMatchObject({ code: 'post.empty_content' });
    await expect(schedule({ channelIds: [] })).rejects.toMatchObject({ code: 'post.no_channels' });
    await expect(schedule({ orgId: 'org-2' })).rejects.toMatchObject({ code: 'common.not_found' });
    await expect(schedule({ text: 'x'.repeat(51) })).rejects.toMatchObject({ code: 'post.too_long' });
  });

  test('canal desativado é recusado', async () => {
    await f.channels.setStatus(f._state.channels[0]!.id, 'DISABLED');
    await expect(schedule()).rejects.toMatchObject({ code: 'channel.disabled' });
  });
});

describe('schedulePost com textByChannel (override por canal — SPEC_FRONTEND §3.3)', () => {
  let ch1: string;
  let ch2: string;
  beforeEach(async () => {
    await connect(f, prov.provider);
    await makeConnectChannel(f as any)({
      orgId: 'org-1',
      provider: prov.provider,
      account: { accessToken: 'tok-9', scopes: [], externalId: 'ext-2', name: 'Conta 2' },
    });
    ch1 = f._state.channels[0]!.id;
    ch2 = f._state.channels[1]!.id;
  });

  test('override aplica só no canal indicado; demais usam o texto global', async () => {
    await schedule({ channelIds: [ch1, ch2], textByChannel: { [ch2]: 'versão do canal 2' } });
    const byCh = (cid: string) => f._state.pubs.find((p) => p.channelId === cid)!;
    expect(byCh(ch1).content.text).toBe('olá mundo');
    expect(byCh(ch2).content.text).toBe('versão do canal 2');
    // item 0 da thread acompanha o override (é o que o worker publica)
    const item0 = f._state.pubItems.find(
      (i: any) => i.publicationId === byCh(ch2).id && i.position === 0,
    );
    expect(item0.content.text).toBe('versão do canal 2');
  });

  test('override é validado pelo maxLength do canal', async () => {
    await expect(
      schedule({ channelIds: [ch1, ch2], textByChannel: { [ch2]: 'x'.repeat(51) } }),
    ).rejects.toMatchObject({ code: 'post.too_long' });
  });

  test('override vazio → post.empty_content; canal fora de channelIds → not_found', async () => {
    await expect(
      schedule({ channelIds: [ch1], textByChannel: { [ch1]: '   ' } }),
    ).rejects.toMatchObject({ code: 'post.empty_content' });
    await expect(
      schedule({ channelIds: [ch1], textByChannel: { [ch2]: 'oi' } }),
    ).rejects.toMatchObject({ code: 'common.not_found' });
  });
});

describe('schedulePost com mídia', () => {
  beforeEach(async () => {
    await connect(f, prov.provider);
    f._state.mediaRecords.push({
      id: 'm-1',
      orgId: 'org-1',
      path: 'org-1/aaa.png',
      mime: 'image/png',
      alt: 'um logo',
    });
  });

  test('resolve refs da biblioteca (URL pública + MIME real) e grava no content', async () => {
    const group = await schedule({ mediaIds: ['m-1'] });
    const content = f._state.pubs[0]!.content as any;
    expect(content.media).toEqual([
      {
        mediaId: 'm-1',
        type: 'image',
        url: 'https://mp.test/uploads/org-1/aaa.png',
        mime: 'image/png',
        alt: 'um logo',
      },
    ]);
    expect(group!.publications[0]!.state).toBe('SCHEDULED');
  });

  test('mídia inexistente ou de outra org → not_found', async () => {
    await expect(schedule({ mediaIds: ['m-alheia'] })).rejects.toMatchObject({
      code: 'common.not_found',
    });
  });

  test('provider recusa (validateMedia) → post.invalid_media', async () => {
    for (let i = 2; i <= 5; i++) {
      f._state.mediaRecords.push({
        id: `m-${i}`,
        orgId: 'org-1',
        path: `org-1/m${i}.png`,
        mime: 'image/png',
        alt: null,
      });
    }
    await expect(
      schedule({ mediaIds: ['m-1', 'm-2', 'm-3', 'm-4', 'm-5'] }),
    ).rejects.toMatchObject({ code: 'post.invalid_media' });
  });

  test('worker entrega a mídia ao provider no publish', async () => {
    const group = await schedule({ mediaIds: ['m-1'] });
    await publish(group!.publications[0]!.id);
    expect(f._state.pubs[0]!.state).toBe('PUBLISHED');
    expect(prov.lastItems()[0].media).toHaveLength(1);
    expect(prov.lastItems()[0].media[0].url).toBe('https://mp.test/uploads/org-1/aaa.png');
  });
});

describe('publishPublication (máquina de estados)', () => {
  let pubId: string;
  beforeEach(async () => {
    await connect(f, prov.provider);
    const group = await schedule();
    pubId = group!.publications[0]!.id;
  });

  test('caminho feliz → PUBLISHED com externalId e grupo DONE', async () => {
    await publish(pubId);
    const pub = f._state.pubs[0]!;
    expect(pub.state).toBe('PUBLISHED');
    expect(pub.externalId).toBe('ext-post-1');
    expect(f._state.groups[0]!.state).toBe('DONE');
    expect(f._state.events.map((e) => e.to)).toEqual(['PUBLISHING', 'PUBLISHED']);
  });

  test('erro transitório → RETRYING + job com backoff; segunda execução publica', async () => {
    behavior.failFirst = 1;
    await publish(pubId);
    expect(f._state.pubs[0]!.state).toBe('RETRYING');
    const retryJob = f._state.jobs.at(-1)!;
    expect(retryJob.opts.singletonKey).toBe(`${pubId}:a1`);
    expect(retryJob.opts.startAfter).toBeInstanceOf(Date);
    await publish(pubId);
    expect(f._state.pubs[0]!.state).toBe('PUBLISHED');
    expect(f._state.pubs[0]!.attemptCount).toBe(2);
  });

  test('esgota tentativas → FAILED transient', async () => {
    behavior.failFirst = 99;
    for (let i = 0; i < 5; i++) await publish(pubId);
    expect(f._state.pubs[0]!.state).toBe('FAILED');
    expect(f._state.pubs[0]!.errorClass).toBe('transient');
  });

  test('erro permanente → FAILED direto, sem retry', async () => {
    behavior.reject = true;
    await publish(pubId);
    expect(f._state.pubs[0]!.state).toBe('FAILED');
    expect(f._state.pubs[0]!.errorClass).toBe('permanent');
    expect(f._state.jobs.filter((j) => j.opts.singletonKey?.includes(':a'))).toHaveLength(0);
  });

  test('401 → refresh do token, re-enqueue e publicação na segunda execução', async () => {
    behavior.expireToken = true;
    await publish(pubId);
    expect(f._state.pubs[0]!.state).toBe('TOKEN_REFRESH');
    const raw = f._state.channels[0]!;
    const aad = channelAad('org-1', 'fake', 'ext-1');
    expect(await crypto.decrypt(raw.tokenEnc, aad, raw.tokenKeyVersion)).toBe('tok-2');
    await publish(pubId); // TOKEN_REFRESH é retomável
    expect(f._state.pubs[0]!.state).toBe('PUBLISHED');
  });

  test('fencing: publicação já PUBLISHED é no-op (dedup de jobs)', async () => {
    await publish(pubId);
    const callsBefore = prov.callCount();
    await publish(pubId);
    expect(prov.callCount()).toBe(callsBefore);
  });
});

describe('cancelar e editar agendados', () => {
  let groupId: string;
  let pubId: string;
  beforeEach(async () => {
    await connect(f, prov.provider);
    const group = await schedule({ publishAt: new Date(Date.now() + 60_000) });
    groupId = group!.id;
    pubId = group!.publications[0]!.id;
  });

  test('cancelar: publicação → CANCELLED e job antigo é descartado pela versão', async () => {
    await makeCancelPost(f as any)('org-1', groupId);
    expect(f._state.pubs[0]!.state).toBe('CANCELLED');
    // job da versão 0 chega atrasado → fencing por estado E versão: no-op
    await publish(pubId);
    expect(prov.callCount()).toBe(0);
    expect(f._state.groups[0]!.state).toBe('PARTIAL');
  });

  test('editar: novo texto/horário, versão sobe e job ANTIGO não publica', async () => {
    const before = f._state.pubs[0]!.jobVersion;
    await makeReschedulePost(f as any)({
      orgId: 'org-1',
      groupId,
      text: 'texto editado',
      publishAt: new Date(Date.now() - 1000),
    });
    const pub = f._state.pubs[0]!;
    expect(pub.jobVersion).toBe(before + 1);
    expect(pub.content.text).toBe('texto editado');
    // job antigo (v0) descartado; job novo (v1) publica o texto editado
    await makePublishPublication({ ...(f as any), retryBaseSec: 0.001 })(pubId, before);
    expect(prov.callCount()).toBe(0);
    await makePublishPublication({ ...(f as any), retryBaseSec: 0.001 })(pubId, pub.jobVersion);
    expect(f._state.pubs[0]!.state).toBe('PUBLISHED');
  });

  test('editar valida limite de caracteres e recusa texto vazio', async () => {
    await expect(
      makeReschedulePost(f as any)({ orgId: 'org-1', groupId, text: 'x'.repeat(51) }),
    ).rejects.toMatchObject({ code: 'post.too_long' });
    await expect(
      makeReschedulePost(f as any)({ orgId: 'org-1', groupId, text: '  ' }),
    ).rejects.toMatchObject({ code: 'post.empty_content' });
  });

  test('publicado não pode ser editado', async () => {
    await makeReschedulePost(f as any)({ orgId: 'org-1', groupId, publishAt: new Date(Date.now() - 1000) });
    await publish(pubId);
    await expect(
      makeReschedulePost(f as any)({ orgId: 'org-1', groupId, text: 'tarde demais' }),
    ).rejects.toMatchObject({ code: 'post.invalid_transition' });
  });

  test('editar settings por canal: merge em publications.settings e re-agenda (versão sobe)', async () => {
    const channelId = f._state.pubs[0]!.channelId;
    const before = f._state.pubs[0]!.jobVersion;
    await makeReschedulePost(f as any)({
      orgId: 'org-1',
      groupId,
      settingsByChannel: { [channelId]: { tag: 'promo' } },
    });
    expect(f._state.pubs[0]!.settings).toMatchObject({ tag: 'promo' });
    expect(f._state.pubs[0]!.jobVersion).toBe(before + 1);
  });

  test('editar settings inválidos por provider → post.invalid_settings', async () => {
    const channelId = f._state.pubs[0]!.channelId;
    await expect(
      makeReschedulePost(f as any)({
        orgId: 'org-1',
        groupId,
        settingsByChannel: { [channelId]: { tag: 123 } },
      }),
    ).rejects.toMatchObject({ code: 'post.invalid_settings' });
  });

  test('settingsByChannel referenciando canal fora do grupo → not_found', async () => {
    await expect(
      makeReschedulePost(f as any)({
        orgId: 'org-1',
        groupId,
        settingsByChannel: { 'canal-fantasma': { tag: 'x' } },
      }),
    ).rejects.toMatchObject({ code: 'common.not_found' });
  });
});

describe('threads (SPEC_QUEUE §7/§9)', () => {
  const threadSchedule = (over: any = {}) =>
    schedule({
      thread: [{ text: 'réplica 1' }, { text: 'réplica 2' }],
      ...over,
    });

  beforeEach(async () => {
    await connect(f, prov.provider);
  });

  test('agendar thread grava os itens com posição e delay', async () => {
    await threadSchedule({ thread: [{ text: 'réplica 1', delaySec: 30 }] });
    expect(f._state.pubItems).toHaveLength(2);
    expect(f._state.pubItems[0]).toMatchObject({ position: 0, delaySec: 0 });
    expect(f._state.pubItems[1]).toMatchObject({
      position: 1,
      content: { text: 'réplica 1' },
      delaySec: 30,
    });
  });

  test('canal sem suporte a thread → capability.disabled; réplica longa → post.too_long', async () => {
    behavior.noThreads = true;
    await expect(threadSchedule()).rejects.toMatchObject({ code: 'capability.disabled' });
    behavior.noThreads = false;
    await expect(
      threadSchedule({ thread: [{ text: 'x'.repeat(51) }] }),
    ).rejects.toMatchObject({ code: 'post.too_long' });
  });

  test('thread sem delay publica tudo numa execução: item 0 + réplicas encadeadas', async () => {
    const group = await threadSchedule();
    await publish(group!.publications[0]!.id);
    const pub = f._state.pubs[0]!;
    expect(pub.state).toBe('PUBLISHED');
    expect(pub.lastPublishedIndex).toBe(2);
    expect(prov.callCount()).toBe(1); // item 0 via publish
    expect(prov.replyCount()).toBe(2); // réplicas via publishReply
    expect(prov.replies()[0]!.parent).toBe('ext-post-1'); // encadeia no anterior
    expect(prov.replies()[1]!.parent).toBe('ext-reply-1');
    expect(f._state.pubItems.map((x: any) => x.externalId)).toEqual([
      'ext-post-1',
      'ext-reply-1',
      'ext-reply-2',
    ]);
  });

  test('delay entre itens: para em PUBLISHING, agenda publish-thread-item e a continuação termina', async () => {
    const group = await threadSchedule({
      thread: [{ text: 'réplica 1', delaySec: 60 }, { text: 'réplica 2' }],
    });
    const pubId = group!.publications[0]!.id;
    await publish(pubId);
    const pub = f._state.pubs[0]!;
    expect(pub.state).toBe('PUBLISHING'); // aguardando o delay
    expect(pub.lastPublishedIndex).toBe(0);
    const contJob = f._state.jobs.at(-1)!;
    expect(contJob.queue).toBe('publish-thread-item');
    expect(contJob.payload).toMatchObject({ publicationId: pubId, v: 0, afterIndex: 0 });
    expect(contJob.opts.startAfter).toBeInstanceOf(Date);

    // continuação com cursor errado (duplicada/obsoleta) é no-op
    await makeContinueThread({ ...(f as any), retryBaseSec: 0.001 })(pubId, 0, 5);
    expect(prov.replyCount()).toBe(0);

    await makeContinueThread({ ...(f as any), retryBaseSec: 0.001 })(pubId, 0, 0);
    expect(f._state.pubs[0]!.state).toBe('PUBLISHED');
    expect(f._state.pubs[0]!.lastPublishedIndex).toBe(2);
    expect(prov.callCount()).toBe(1); // item 0 NUNCA repostado
  });

  test('falha transitória numa réplica: RETRYING e o retry retoma do cursor sem repostar', async () => {
    behavior.failReplyFirst = 1;
    const group = await threadSchedule({ thread: [{ text: 'réplica 1' }] });
    const pubId = group!.publications[0]!.id;
    await publish(pubId);
    const pub = f._state.pubs[0]!;
    expect(pub.state).toBe('RETRYING');
    expect(pub.lastPublishedIndex).toBe(0); // item 0 confirmado
    expect(pub.errorMessage).toContain('item 1');

    await publish(pubId); // retry
    expect(pub.state).toBe('PUBLISHED');
    expect(prov.callCount()).toBe(1); // item 0 publicado UMA vez (SPEC_QUEUE §7)
    expect(prov.replies()).toHaveLength(1);
  });

  test('post editado/cancelado mata a continuação pela versão do job', async () => {
    const group = await threadSchedule({
      publishAt: new Date(Date.now() + 60_000),
      thread: [{ text: 'réplica 1', delaySec: 60 }],
    });
    const pubId = group!.publications[0]!.id;
    await publish(pubId);
    expect(f._state.pubs[0]!.state).toBe('PUBLISHING');
    f._state.pubs[0]!.jobVersion++; // simula edit/cancel bumpando a versão
    await makeContinueThread({ ...(f as any), retryBaseSec: 0.001 })(pubId, 0, 0);
    expect(prov.replyCount()).toBe(0); // continuação da versão antiga descartada
  });
});

describe('retry manual (kanban "tentar novamente")', () => {
  beforeEach(async () => {
    await connect(f, prov.provider);
  });

  test('FAILED volta a SCHEDULED com tentativas zeradas e versão nova; job antigo morre', async () => {
    behavior.reject = true;
    const group = await schedule();
    const pubId = group!.publications[0]!.id;
    await publish(pubId);
    expect(f._state.pubs[0]!.state).toBe('FAILED');

    behavior.reject = false; // "a rede parou de rejeitar"
    await makeRetryPost(f as any)({ orgId: 'org-1', groupId: group!.id });
    const pub = f._state.pubs[0]!;
    expect(pub.state).toBe('SCHEDULED');
    expect(pub.attemptCount).toBe(0);
    expect(pub.jobVersion).toBe(1);
    expect(pub.errorClass).toBeNull();
    const job = f._state.jobs.at(-1)!;
    expect(job.payload).toMatchObject({ publicationId: pubId, v: 1 });

    await makePublishPublication({ ...(f as any), retryBaseSec: 0.001 })(pubId, 0); // job velho
    expect(f._state.pubs[0]!.state).toBe('SCHEDULED'); // descartado pela versão
    await makePublishPublication({ ...(f as any), retryBaseSec: 0.001 })(pubId, 1);
    expect(f._state.pubs[0]!.state).toBe('PUBLISHED');
  });

  test('NEEDS_REVIEW é retryable (ação humana — DECISIONS §7 só proíbe repost automático)', async () => {
    const group = await schedule();
    f._state.pubs[0]!.state = 'NEEDS_REVIEW';
    await makeRetryPost(f as any)({ orgId: 'org-1', groupId: group!.id });
    expect(f._state.pubs[0]!.state as string).toBe('SCHEDULED');
  });

  test('channelId filtra: só a publicação daquele canal é repetida; nada falhado → erro', async () => {
    const group = await schedule();
    await expect(
      makeRetryPost(f as any)({ orgId: 'org-1', groupId: group!.id }),
    ).rejects.toMatchObject({ code: 'post.invalid_transition' }); // ainda SCHEDULED

    f._state.pubs[0]!.state = 'FAILED';
    await makeRetryPost(f as any)({
      orgId: 'org-1',
      groupId: group!.id,
      channelId: 'canal-que-nao-existe',
    }).then(
      () => {
        throw new Error('deveria falhar');
      },
      (err) => expect(err).toMatchObject({ code: 'post.invalid_transition' }),
    );
    await makeRetryPost(f as any)({
      orgId: 'org-1',
      groupId: group!.id,
      channelId: f._state.pubs[0]!.channelId,
    });
    expect(f._state.pubs[0]!.state as string).toBe('SCHEDULED');
  });
});

describe('evento post.scheduled (SPEC_API_MCP §4)', () => {
  beforeEach(async () => {
    await connect(f, prov.provider);
  });

  test('agendar emite post.scheduled; rascunho (requireApproval) NÃO emite', async () => {
    const emitted: any[] = [];
    const events = { emit: async (e: any) => void emitted.push(e) };
    await makeSchedulePost({ ...(f as any), events })({
      orgId: 'org-1',
      authorId: 'u1',
      text: 'agendado',
      channelIds: [f._state.channels[0]!.id],
      publishAt: new Date(),
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ event: 'post.scheduled', orgId: 'org-1' });

    await makeSchedulePost({ ...(f as any), events })({
      orgId: 'org-1',
      authorId: 'u1',
      text: 'rascunho',
      channelIds: [f._state.channels[0]!.id],
      publishAt: new Date(),
      requireApproval: true,
    });
    expect(emitted).toHaveLength(1); // nada novo
  });
});

describe('rate-limit por janela (SPEC_QUEUE §6)', () => {
  test('negado: re-enfileira com retryAfter e NÃO consome tentativa', async () => {
    await connect(f, prov.provider);
    const group = await schedule();
    const pubId = group!.publications[0]!.id;
    const limiter = {
      acquire: async () => ({ ok: false as const, retryAfterSec: 42 }),
    };
    await makePublishPublication({ ...(f as any), retryBaseSec: 1, rateLimiter: limiter })(pubId);
    const pub = f._state.pubs[0]!;
    expect(pub.state).toBe('SCHEDULED'); // não reivindicou
    expect(pub.attemptCount).toBe(0);
    const job = f._state.jobs.at(-1)!;
    expect(job.opts.singletonKey).toContain(':rl:');
    expect(prov.callCount()).toBe(0);
  });
});

describe('semáforo de concorrência (maxConcurrent, SPEC_QUEUE §6)', () => {
  const okWindow = { acquire: async () => ({ ok: true as const }) };

  test('slot negado: re-enfileira com :sem:, NÃO consome tentativa nem publica', async () => {
    await connect(f, prov.provider);
    const group = await schedule();
    const pubId = group!.publications[0]!.id;
    const denied: unknown[][] = [];
    const limiter = {
      ...okWindow,
      acquireSlot: async () => ({ ok: false as const, retryAfterSec: 3 }),
      releaseSlot: async () => {},
    };
    const metrics = { onRateLimitDenied: (p: string, r: string) => denied.push([p, r]) };
    await makePublishPublication({
      ...(f as any),
      retryBaseSec: 1,
      rateLimiter: limiter,
      metrics,
    })(pubId);
    const pub = f._state.pubs[0]!;
    expect(pub.state).toBe('SCHEDULED'); // não reivindicou
    expect(pub.attemptCount).toBe(0);
    expect(f._state.jobs.at(-1)!.opts.singletonKey).toContain(':sem:');
    expect(prov.callCount()).toBe(0);
    expect(denied).toEqual([['fake', 'concurrency']]);
  });

  test('slot concedido: publica e libera o slot exatamente uma vez ao terminar', async () => {
    await connect(f, prov.provider);
    const group = await schedule();
    const pubId = group!.publications[0]!.id;
    let acquired = 0;
    const released: string[] = [];
    const results: string[] = [];
    const limiter = {
      ...okWindow,
      acquireSlot: async () => {
        acquired++;
        return { ok: true as const };
      },
      releaseSlot: async (key: string) => {
        released.push(key);
      },
    };
    const metrics = { onPublicationResult: (_p: string, s: string) => results.push(s) };
    await makePublishPublication({
      ...(f as any),
      retryBaseSec: 1,
      rateLimiter: limiter,
      metrics,
    })(pubId);
    expect(f._state.pubs[0]!.state).toBe('PUBLISHED');
    expect(acquired).toBe(1);
    expect(released).toEqual(['sem:p:fake']); // liberado 1x, com a chave do provider
    expect(results).toEqual(['published']);
  });

  test('provider maxConcurrent > 0 mas limiter sem acquireSlot: publica normal (semáforo é opcional)', async () => {
    await connect(f, prov.provider);
    const group = await schedule();
    const pubId = group!.publications[0]!.id;
    await makePublishPublication({
      ...(f as any),
      retryBaseSec: 1,
      rateLimiter: okWindow, // só janela, sem acquireSlot/releaseSlot
    })(pubId);
    expect(f._state.pubs[0]!.state).toBe('PUBLISHED');
  });
});

describe('recover scanner', () => {
  test('SCHEDULED vencida sem job é re-enfileirada', async () => {
    await connect(f, prov.provider);
    await schedule({ publishAt: new Date(Date.now() - 10_000) }); // além da tolerância de 3s do scanner
    f._state.jobs.length = 0; // simula fila perdida
    const out = await makeRecoverDue(f as any)();
    expect(out.due).toBe(1);
    expect(f._state.jobs[0]!.queue).toBe('publish');
  });
});
