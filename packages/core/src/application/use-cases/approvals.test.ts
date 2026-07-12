import { beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { ChannelProvider } from '@manypost/contracts';
import type { ApprovalLinkRecord } from '../ports/approvals';
import { sha256Hex } from '../tokens';
import {
  makeCreateApprovalLink,
  makeGetApprovalLinkStatus,
  makeGetApprovalPreview,
  makeResolveApproval,
  makeRevokeApprovalLink,
} from './approvals';
import { makeCancelPost, makeReschedulePost, makeSchedulePost } from './publishing';

// ------- mundo fake mínimo: grupos/publicações + links + trilhas -------

const provider: ChannelProvider = {
  id: 'fake',
  name: 'Fake',
  capabilities: {
    editor: 'plain',
    maxLength: () => 50,
    media: { images: { maxCount: 4, mimeTypes: [] }, videos: { maxCount: 1, mimeTypes: [] } },
    threads: true,
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: { maxConcurrent: 2 },
  settingsSchema: z.object({}).passthrough(),
  async getAuthUrl() {
    return { url: 'http://fake', state: 's' };
  },
  async exchangeCode() {
    return { accessToken: 't', scopes: [], externalId: 'ext-1', name: 'Conta Fake' };
  },
  async refreshToken() {
    return { accessToken: 't2', scopes: [] };
  },
  async publish() {
    return [{ externalId: 'x' }];
  },
  async publishReply() {
    return { externalId: 'r' };
  },
  async validateMedia() {
    return { ok: true as const };
  },
  classifyError: () => 'permanent',
};

function makeWorld() {
  let seq = 0;
  const id = () => `id-${++seq}`;

  const channels = [
    {
      id: 'ch-1',
      orgId: 'org-1',
      provider: 'fake',
      externalId: 'ext-1',
      name: 'Conta Fake',
      username: 'contafake',
      avatarUrl: 'https://fake/a.png',
      status: 'ACTIVE',
      scopes: [],
      settings: {},
      tokenEnc: new Uint8Array(),
      refreshTokenEnc: null,
      tokenKeyVersion: 1,
      tokenExpiresAt: null,
    },
  ];
  const groups: any[] = [];
  const pubs: any[] = [];
  const pubItems: any[] = [];
  const links: ApprovalLinkRecord[] = [];
  const tokenHashById = new Map<string, string>();
  const jobs: Array<{ queue: string; payload: any; opts: any }> = [];
  const audits: any[] = [];
  const notifs: any[] = [];
  const emitted: any[] = [];
  const realtimeEvents: Array<{ orgId: string; e: any }> = [];

  const publishing = {
    createGroup: async (d: any) => {
      const state = d.state ?? 'SCHEDULED';
      const g = { id: id(), orgId: d.orgId, state, publishAt: d.publishAt, timezone: d.timezone, baseContent: d.baseContent };
      groups.push(g);
      const created = d.publications.map((p: any) => {
        const pub = {
          id: id(),
          orgId: d.orgId,
          groupId: g.id,
          channelId: p.channelId,
          state,
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
          pubItems.push({ id: id(), publicationId: pub.id, position, content: item.content, media: item.media, delaySec: item.delaySec, externalId: null });
        }
        return { id: pub.id, channelId: p.channelId };
      });
      return { groupId: g.id, publications: created };
    },
    getGroup: async (orgId: string, gid: string) => {
      const g = groups.find((x) => x.id === gid && x.orgId === orgId);
      if (!g) return null;
      return { ...g, publications: pubs.filter((p) => p.groupId === gid) };
    },
    listItems: async (pid: string) =>
      pubItems.filter((x) => x.publicationId === pid).sort((a, b) => a.position - b.position),
    transition: async (pid: string, from: string[], to: string, patch?: any) => {
      const p = pubs.find((x) => x.id === pid)!;
      if (!from.includes(p.state)) return false;
      p.state = to;
      if (patch?.bumpJobVersion) p.jobVersion++;
      return true;
    },
    refreshGroupState: async (gid: string) => {
      const list = pubs.filter((p) => p.groupId === gid);
      const g = groups.find((x) => x.id === gid)!;
      if (list.every((p) => p.state === 'CANCELLED')) g.state = 'CANCELLED';
    },
    updateDraftGroup: async (orgId: string, gid: string, d: any) => {
      const g = groups.find((x) => x.id === gid && x.orgId === orgId && x.state === 'DRAFT');
      if (!g) return false;
      if (d.baseContent) g.baseContent = { ...g.baseContent, ...d.baseContent };
      if (d.publishAt) g.publishAt = d.publishAt;
      for (const p of pubs.filter((x) => x.groupId === gid && x.state === 'DRAFT')) {
        if (d.baseContent) p.content = { ...p.content, ...d.baseContent };
        if (d.publishAt) p.publishAt = d.publishAt;
      }
      return true;
    },
    scheduleDraftGroup: async (orgId: string, gid: string) => {
      const g = groups.find((x) => x.id === gid && x.orgId === orgId && x.state === 'DRAFT');
      if (!g) return [];
      g.state = 'SCHEDULED';
      return pubs
        .filter((p) => p.groupId === gid && p.state === 'DRAFT')
        .map((p) => {
          p.state = 'SCHEDULED';
          return { id: p.id, channelId: p.channelId, jobVersion: p.jobVersion, publishAt: p.publishAt };
        });
    },
    rescheduleGroup: async () => [],
    findForPublish: async () => null,
    listDue: async () => [],
    listStuck: async () => [],
    recordItemPublished: async () => {},
  };

  const approvals = {
    create: async (d: { orgId: string; groupId: string; tokenHash: string; expiresAt: Date }) => {
      const link: ApprovalLinkRecord = {
        id: id(),
        orgId: d.orgId,
        groupId: d.groupId,
        status: 'PENDING',
        feedback: null,
        approverName: null,
        expiresAt: d.expiresAt,
        resolvedAt: null,
        createdAt: new Date(),
      };
      links.push(link);
      tokenHashById.set(link.id, d.tokenHash);
      return link;
    },
    findByTokenHash: async (h: string) => {
      const found = [...links].reverse().find((l) => tokenHashById.get(l.id) === h);
      return found ?? null;
    },
    latestByGroup: async (orgId: string, gid: string) =>
      [...links].reverse().find((l) => l.orgId === orgId && l.groupId === gid) ?? null,
    resolve: async (lid: string, to: any, d?: any) => {
      const l = links.find((x) => x.id === lid);
      if (!l || l.status !== 'PENDING') return false;
      l.status = to;
      l.resolvedAt = new Date();
      if (d?.feedback !== undefined) l.feedback = d.feedback;
      if (d?.approverName !== undefined) l.approverName = d.approverName;
      return true;
    },
    revokePending: async (orgId: string, gid: string) => {
      const pending = links.filter(
        (l) => l.orgId === orgId && l.groupId === gid && l.status === 'PENDING',
      );
      for (const l of pending) {
        l.status = 'REVOKED';
        l.resolvedAt = new Date();
      }
      return pending.length;
    },
  };

  const deps = {
    publishing,
    approvals,
    channels: {
      findMany: async (orgId: string, ids: string[]) =>
        channels.filter((c) => c.orgId === orgId && ids.includes(c.id)),
      upsert: async () => channels[0],
      list: async () => channels,
      updateTokens: async () => {},
      setStatus: async () => {},
      softDelete: async () => true,
    },
    registry: { get: (pid: string) => (pid === 'fake' ? provider : undefined), list: () => [provider] },
    scheduler: {
      enqueue: async (queue: string, payload: any, opts: any) => {
        jobs.push({ queue, payload, opts });
        return `job-${jobs.length}`;
      },
      cancelBySingletonKey: async () => {},
      schedule: async () => {},
    },
    audit: {
      append: async (e: any) => {
        audits.push(e);
      },
    },
    notifications: {
      create: async (n: any) => {
        notifs.push(n);
      },
      list: async () => notifs as any,
      markRead: async () => true,
      markAllRead: async () => 0,
    },
    events: {
      emit: async (e: any) => {
        emitted.push(e);
      },
    },
    realtime: {
      publish: async (orgId: string, e: any) => {
        realtimeEvents.push({ orgId, e });
      },
    },
    _state: { groups, pubs, links, jobs, audits, notifs, emitted, realtimeEvents },
  };
  return deps;
}

let w: ReturnType<typeof makeWorld>;

const scheduleDraft = () =>
  makeSchedulePost(w as any)({
    orgId: 'org-1',
    authorId: 'u1',
    text: 'post aguardando o cliente',
    channelIds: ['ch-1'],
    publishAt: new Date(Date.now() + 60_000),
    requireApproval: true,
  });

const createLink = (over: any = {}) =>
  makeCreateApprovalLink(w as any)({
    orgId: 'org-1',
    groupId: w._state.groups[0]!.id,
    actorId: 'u1',
    ...over,
  });

beforeEach(() => {
  w = makeWorld();
});

describe('requireApproval no agendamento', () => {
  test('grupo e publicações nascem DRAFT e nenhum job é enfileirado', async () => {
    const group = await scheduleDraft();
    expect(group!.state).toBe('DRAFT');
    expect(group!.publications[0]!.state).toBe('DRAFT');
    expect(w._state.jobs).toHaveLength(0);
  });
});

describe('criar/revogar link (equipe)', () => {
  beforeEach(async () => {
    await scheduleDraft();
  });

  test('retorna token ≥ 256 bits e persiste só o hash; audita a criação', async () => {
    const out = await createLink();
    expect(out.token.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url
    expect(JSON.stringify(w._state.links)).not.toContain(out.token);
    expect(w._state.audits.at(-1)).toMatchObject({ action: 'approval_link.created', actorType: 'USER' });
  });

  test('criar de novo revoga o link anterior (1 ativo por grupo)', async () => {
    await createLink();
    await createLink();
    expect(w._state.links.map((l) => l.status)).toEqual(['REVOKED', 'PENDING']);
  });

  test('grupo agendado (não-rascunho) é recusado', async () => {
    w._state.groups[0]!.state = 'SCHEDULED';
    await expect(createLink()).rejects.toMatchObject({ code: 'post.invalid_transition' });
  });

  test('revogar manualmente + status lazy-expira link vencido', async () => {
    await createLink();
    const revoked = await makeRevokeApprovalLink(w as any)({ orgId: 'org-1', groupId: w._state.groups[0]!.id });
    expect(revoked).toEqual({ revoked: true });

    await createLink({ expiresInHours: 1 });
    w._state.links.at(-1)!.expiresAt = new Date(Date.now() - 1000);
    const status = await makeGetApprovalLinkStatus(w as any)('org-1', w._state.groups[0]!.id);
    expect(status!.status).toBe('EXPIRED');
  });
});

describe('preview público', () => {
  let token: string;
  beforeEach(async () => {
    await scheduleDraft();
    token = (await createLink()).token;
  });

  test('mostra canal + itens e nada além do preview (sem ids internos)', async () => {
    const preview = await makeGetApprovalPreview(w as any)(token);
    expect(preview.status).toBe('PENDING');
    expect(preview.timezone).toBe('UTC');
    expect(preview.publications[0]).toMatchObject({
      provider: 'fake',
      channelName: 'Conta Fake',
      channelUsername: 'contafake',
    });
    expect(preview.publications[0]!.items[0]!.text).toBe('post aguardando o cliente');
    const json = JSON.stringify(preview);
    expect(json).not.toContain('org-1'); // sem dados da org
    expect(json).not.toContain('"channelId"');
    expect(json).not.toContain('"mediaId"');
  });

  test('token inválido, expirado ou revogado → not_found uniforme', async () => {
    await expect(makeGetApprovalPreview(w as any)('token-que-nao-existe-aaaa')).rejects.toMatchObject({
      code: 'common.not_found',
    });

    w._state.links[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(makeGetApprovalPreview(w as any)(token)).rejects.toMatchObject({
      code: 'common.not_found',
    });
    expect(w._state.links[0]!.status).toBe('EXPIRED'); // expirou lazy

    const token2 = (await createLink()).token;
    await makeRevokeApprovalLink(w as any)({ orgId: 'org-1', groupId: w._state.groups[0]!.id });
    await expect(makeGetApprovalPreview(w as any)(token2)).rejects.toMatchObject({
      code: 'common.not_found',
    });
  });

  test('link resolvido ainda mostra o preview com o resultado (página "já resolvido")', async () => {
    await makeResolveApproval(w as any)({ token, action: 'approve' });
    const preview = await makeGetApprovalPreview(w as any)(token);
    expect(preview.status).toBe('APPROVED');
  });
});

describe('resolver: aprovar / pedir ajustes', () => {
  let token: string;
  beforeEach(async () => {
    await scheduleDraft();
    token = (await createLink()).token;
  });

  test('aprovar agenda o grupo (DRAFT→SCHEDULED + job) e audita como PUBLIC_LINK', async () => {
    const out = await makeResolveApproval(w as any)({ token, action: 'approve', approverName: 'Cliente X', ip: '1.2.3.4' });
    expect(out).toMatchObject({ status: 'APPROVED', alreadyResolved: false });
    expect(w._state.groups[0]!.state).toBe('SCHEDULED');
    expect(w._state.pubs[0]!.state).toBe('SCHEDULED');
    expect(w._state.jobs).toHaveLength(1);
    expect(w._state.jobs[0]).toMatchObject({
      queue: 'publish',
      payload: { publicationId: w._state.pubs[0]!.id, v: 0 },
      opts: { singletonKey: w._state.pubs[0]!.id },
    });
    expect(w._state.audits.at(-1)).toMatchObject({
      action: 'approval.approved',
      actorType: 'PUBLIC_LINK',
      ip: '1.2.3.4',
    });
    expect(w._state.notifs[0]!.title).toBe('Cliente aprovou o post');
  });

  test('idempotente: segunda chamada (qualquer ação) devolve o resolvido sem agir de novo', async () => {
    await makeResolveApproval(w as any)({ token, action: 'approve' });
    const again = await makeResolveApproval(w as any)({ token, action: 'request_changes', feedback: 'tarde' });
    expect(again).toMatchObject({ status: 'APPROVED', alreadyResolved: true });
    expect(w._state.jobs).toHaveLength(1); // nenhum job novo
    expect(w._state.notifs).toHaveLength(1); // nenhuma notificação nova
  });

  test('pedir ajustes guarda feedback, mantém rascunho e notifica', async () => {
    const out = await makeResolveApproval(w as any)({
      token,
      action: 'request_changes',
      feedback: 'troca a foto, por favor',
      approverName: 'Cliente X',
    });
    expect(out.status).toBe('CHANGES_REQUESTED');
    expect(w._state.groups[0]!.state).toBe('DRAFT');
    expect(w._state.jobs).toHaveLength(0);
    expect(w._state.links[0]).toMatchObject({
      status: 'CHANGES_REQUESTED',
      feedback: 'troca a foto, por favor',
      approverName: 'Cliente X',
    });
    expect(w._state.notifs[0]).toMatchObject({
      title: 'Cliente pediu ajustes no post',
      body: 'troca a foto, por favor',
    });
  });

  test('aprovar emite post.scheduled (webhooks) e notification.created (SSE)', async () => {
    await makeResolveApproval(w as any)({ token, action: 'approve' });
    expect(w._state.emitted).toContainEqual(
      expect.objectContaining({ event: 'post.scheduled', orgId: 'org-1' }),
    );
    expect(w._state.realtimeEvents).toContainEqual(
      expect.objectContaining({
        orgId: 'org-1',
        e: expect.objectContaining({ type: 'notification.created' }),
      }),
    );
  });

  test('aprovado depois de o grupo ser cancelado: resolve mas não agenda nada', async () => {
    w._state.groups[0]!.state = 'CANCELLED';
    w._state.pubs[0]!.state = 'CANCELLED';
    const out = await makeResolveApproval(w as any)({ token, action: 'approve' });
    expect(out.status).toBe('APPROVED');
    expect(w._state.jobs).toHaveLength(0);
  });
});

describe('rascunho × cancelar/editar (revogação do link)', () => {
  beforeEach(async () => {
    await scheduleDraft();
    await createLink();
  });

  test('cancelar rascunho cancela publicações e revoga o link pendente', async () => {
    await makeCancelPost(w as any)('org-1', w._state.groups[0]!.id);
    expect(w._state.pubs[0]!.state).toBe('CANCELLED');
    expect(w._state.groups[0]!.state).toBe('CANCELLED');
    expect(w._state.links[0]!.status).toBe('REVOKED');
  });

  test('editar rascunho permanece DRAFT sem job e revoga o link (cliente não viu a edição)', async () => {
    const group = await makeReschedulePost(w as any)({
      orgId: 'org-1',
      groupId: w._state.groups[0]!.id,
      text: 'texto novo',
    });
    expect(group!.state).toBe('DRAFT');
    expect(group!.publications[0]!.content.text).toBe('texto novo');
    expect(w._state.jobs).toHaveLength(0);
    expect(w._state.links[0]!.status).toBe('REVOKED');
  });
});
