import { beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { ChannelProvider, PublicationState } from '@manypost/contracts';
import { AesGcmCryptoService } from '../../infra/crypto/aes-gcm.service';
import type { ChannelRecord, PublicationView } from '../ports/publishing';
import { channelAad, makeConnectChannel } from './channels';
import {
  makeCancelPost,
  makePublishPublication,
  makeRecoverDue,
  makeReschedulePost,
  makeSchedulePost,
} from './publishing';

const crypto = AesGcmCryptoService.fromHex('b'.repeat(64));

// ------- provider fake controlável -------
function makeProvider(behavior: { failFirst?: number; expireToken?: boolean; reject?: boolean }) {
  let calls = 0;
  let lastItems: any[] = [];
  const provider: ChannelProvider = {
    id: 'fake',
    name: 'Fake',
    capabilities: {
      editor: 'plain',
      maxLength: () => 50,
      media: { images: { maxCount: 4, mimeTypes: [] }, videos: { maxCount: 1, mimeTypes: [] } },
      threads: false,
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
  return { provider, callCount: () => calls, lastItems: () => lastItems };
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
            externalId: null,
            releaseUrl: null,
            errorClass: null,
            errorMessage: null,
          };
          pubs.push(pub);
          return { id: pub.id, channelId: p.channelId };
        });
        return { groupId: g.id, publications: created };
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
    _state: { channels, pubs, events, jobs, groups, mediaRecords },
  };
  return deps;
}

async function connect(deps: any, provider: ChannelProvider, orgId = 'org-1') {
  const account = await provider.exchangeCode({} as any, { code: 'x', redirectUri: 'r' });
  return makeConnectChannel(deps)({ orgId, provider, account });
}

let behavior: { failFirst?: number; expireToken?: boolean; reject?: boolean };
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
