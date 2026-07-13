import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { blueskyProvider as p } from './bluesky.provider';

runProviderContract(p);

const SESSION = {
  did: 'did:plc:abc123',
  handle: 'voce.bsky.social',
  accessJwt: 'access-jwt',
  refreshJwt: 'refresh-jwt',
};

/** roteia por método xrpc (último segmento do path). */
const route = (routes: Record<string, (body: any, url: string) => Response>) =>
  mockCtx((url, init) => {
    const method = url.split('/xrpc/')[1]?.split('?')[0] ?? '';
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const handler = routes[method];
    return handler ? handler(body, url) : jsonResponse({ error: 'NotMocked', message: method }, 404);
  });

const token = { accessToken: 'access-jwt', refreshToken: 'refresh-jwt', scopes: [] };

describe('bluesky: conexão por app password', () => {
  test('createSession + perfil → did como externalId, refreshJwt guardado', async () => {
    const ctx = route({
      'com.atproto.server.createSession': (b) => {
        expect(b).toEqual({ identifier: 'voce.bsky.social', password: 'xxxx-xxxx' });
        return jsonResponse(SESSION);
      },
      'app.bsky.actor.getProfile': () => jsonResponse({ displayName: 'Você', avatar: 'https://av' }),
    });
    const account = await p.connectWithFields!(ctx, {
      fields: { handle: '@voce.bsky.social', appPassword: 'xxxx-xxxx' },
    });
    expect(account).toMatchObject({
      accessToken: 'access-jwt',
      refreshToken: 'refresh-jwt',
      externalId: 'did:plc:abc123',
      name: 'Você',
      username: 'voce.bsky.social',
      avatarUrl: 'https://av',
    });
    // sem service custom, não grava channelSettings (usa bsky.social)
    expect(account.channelSettings).toBeUndefined();
  });

  test('credenciais inválidas → {status} propagado (permanent)', async () => {
    const ctx = route({
      'com.atproto.server.createSession': () =>
        jsonResponse({ error: 'AuthenticationRequired' }, 401),
    });
    await expect(
      p.connectWithFields!(ctx, { fields: { handle: 'x', appPassword: 'y' } }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test('PDS custom (service) é persistido em channelSettings', async () => {
    const ctx = route({
      'com.atproto.server.createSession': () => jsonResponse(SESSION),
      'app.bsky.actor.getProfile': () => jsonResponse({}),
    });
    const account = await p.connectWithFields!(ctx, {
      fields: { handle: 'a', appPassword: 'b', service: 'https://pds.exemplo.com/' },
    });
    expect(account.channelSettings).toEqual({ service: 'https://pds.exemplo.com' });
  });
});

describe('bluesky: publicação', () => {
  test('texto puro: refreshSession → createRecord com langs e createdAt', async () => {
    let recordBody: any;
    const ctx = route({
      'com.atproto.server.refreshSession': () => jsonResponse(SESSION),
      'com.atproto.repo.createRecord': (b) => {
        recordBody = b;
        return jsonResponse({ uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz', cid: 'cid1' });
      },
      'app.bsky.feed.getPosts': () =>
        jsonResponse({ posts: [{ uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz', cid: 'cid1' }] }),
    });
    const [res] = await p.publish(ctx, token, [{ content: 'olá bsky', media: [] }], {});
    expect(recordBody.repo).toBe('did:plc:abc123');
    expect(recordBody.collection).toBe('app.bsky.feed.post');
    expect(recordBody.record).toMatchObject({
      $type: 'app.bsky.feed.post',
      text: 'olá bsky',
      langs: ['pt'],
      createdAt: '2026-01-01T12:00:00.000Z',
    });
    expect(recordBody.record.embed).toBeUndefined();
    expect(res).toEqual({
      externalId: 'at://did:plc:abc123/app.bsky.feed.post/xyz',
      releaseUrl: 'https://bsky.app/profile/voce.bsky.social/post/xyz',
    });
  });

  test('com imagem: uploadBlob → embed app.bsky.embed.images com alt', async () => {
    let recordBody: any;
    const ctx = route({
      'com.atproto.server.refreshSession': () => jsonResponse(SESSION),
      'com.atproto.repo.uploadBlob': () => jsonResponse({ blob: { $type: 'blob', ref: 'blobref' } }),
      'com.atproto.repo.createRecord': (b) => {
        recordBody = b;
        return jsonResponse({ uri: 'at://did:plc:abc123/app.bsky.feed.post/img', cid: 'cidimg' });
      },
      'app.bsky.feed.getPosts': () =>
        jsonResponse({ posts: [{ uri: 'at://did:plc:abc123/app.bsky.feed.post/img', cid: 'cidimg' }] }),
    });
    // a URL da imagem é buscada pelo fetch mockado também (retorna bytes)
    ctx.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      if (url.startsWith('https://mp/uploads/')) return new Response(new Uint8Array([1, 2, 3]));
      const method = url.split('/xrpc/')[1]?.split('?')[0] ?? '';
      const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const routes: Record<string, () => Response> = {
        'com.atproto.server.refreshSession': () => jsonResponse(SESSION),
        'com.atproto.repo.uploadBlob': () => jsonResponse({ blob: { $type: 'blob' } }),
        'com.atproto.repo.createRecord': () => {
          recordBody = body;
          return jsonResponse({ uri: 'at://did:plc:abc123/app.bsky.feed.post/img', cid: 'cidimg' });
        },
        'app.bsky.feed.getPosts': () =>
          jsonResponse({ posts: [{ uri: 'at://did:plc:abc123/app.bsky.feed.post/img', cid: 'cidimg' }] }),
      };
      return routes[method]?.() ?? jsonResponse({ error: 'nope' }, 404);
    }) as typeof fetch;

    await p.publish(
      ctx,
      token,
      [{ content: 'foto', media: [{ type: 'image', url: 'https://mp/uploads/a.png', mime: 'image/png', alt: 'gato' }] }],
      {},
    );
    expect(recordBody.record.embed).toEqual({
      $type: 'app.bsky.embed.images',
      images: [{ image: { $type: 'blob' }, alt: 'gato' }],
    });
  });

  test('publishReply encadeia no root correto quando o pai já é réplica', async () => {
    let recordBody: any;
    const ROOT = { uri: 'at://did/app.bsky.feed.post/root', cid: 'cidroot' };
    const ctx = route({
      'com.atproto.server.refreshSession': () => jsonResponse(SESSION),
      'app.bsky.feed.getPosts': () =>
        jsonResponse({
          posts: [
            {
              uri: 'at://did/app.bsky.feed.post/parent',
              cid: 'cidparent',
              record: { reply: { root: ROOT } },
            },
          ],
        }),
      'com.atproto.repo.createRecord': (b) => {
        recordBody = b;
        return jsonResponse({ uri: 'at://did/app.bsky.feed.post/reply', cid: 'cidreply' });
      },
    });
    await p.publishReply!(
      ctx,
      token,
      'at://did/app.bsky.feed.post/parent',
      { content: 'resposta', media: [] },
      {},
    );
    expect(recordBody.record.reply).toEqual({
      root: ROOT,
      parent: { uri: 'at://did/app.bsky.feed.post/parent', cid: 'cidparent' },
    });
  });

  test('classifyError: token expirado → refresh-token; 5xx → transient', () => {
    expect(p.classifyError(401, '')).toBe('refresh-token');
    expect(p.classifyError(400, '{"error":"ExpiredToken"}')).toBe('refresh-token');
    expect(p.classifyError(502, '')).toBe('transient');
    expect(p.classifyError(400, 'InvalidRequest')).toBe('permanent');
  });
});
