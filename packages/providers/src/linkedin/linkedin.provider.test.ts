import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { linkedinProvider as p } from './linkedin.provider';

runProviderContract(p);

const SECRETS = { clientId: 'cid', clientSecret: 'csec' };
const token = { accessToken: 'at', scopes: ['w_member_social'] };
const USERINFO = { sub: 'AbC123', name: 'Fulana Silva', picture: 'https://li/av.jpg' };

/** roteia por trecho da URL, na ordem declarada. */
const route = (routes: Array<[string, (body: any, init?: RequestInit) => Response]>) =>
  mockCtx((url, init) => {
    const body =
      init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? hit[1](body, init) : jsonResponse({ error: 'NotMocked', url }, 404);
  }, SECRETS);

describe('linkedin: OAuth', () => {
  test('getAuthUrl usa client_id do env e escopos de membro', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(u.searchParams.get('client_id')).toBe('cid');
    expect(u.searchParams.get('redirect_uri')).toBe('https://mp/cb');
    expect(u.searchParams.get('scope')).toBe('openid profile w_member_social');
    expect(u.searchParams.get('state')).toBe(out.state);
  });

  test('exchangeCode: form golden + userinfo → sub como externalId e expiresAt', async () => {
    let form: URLSearchParams | undefined;
    const ctx = route([
      [
        '/oauth/v2/accessToken',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          return jsonResponse({
            access_token: 'at',
            expires_in: 5_184_000,
            refresh_token: 'rt',
            scope: 'openid,profile,w_member_social',
          });
        },
      ],
      ['/v2/userinfo', () => jsonResponse(USERINFO)],
    ]);
    const account = await p.exchangeCode(ctx, { code: 'c0d3', redirectUri: 'https://mp/cb' });
    expect(Object.fromEntries(form!)).toEqual({
      grant_type: 'authorization_code',
      code: 'c0d3',
      redirect_uri: 'https://mp/cb',
      client_id: 'cid',
      client_secret: 'csec',
    });
    expect(account).toMatchObject({
      accessToken: 'at',
      refreshToken: 'rt',
      externalId: 'AbC123',
      name: 'Fulana Silva',
      avatarUrl: 'https://li/av.jpg',
      // ctx.now (2026-01-01) + 60 dias
      expiresAt: new Date(Date.parse('2026-01-01T12:00:00Z') + 5_184_000_000).toISOString(),
    });
  });

  test('exchangeCode sem w_member_social → recusa antes de criar canal', async () => {
    const ctx = route([
      ['/oauth/v2/accessToken', () => jsonResponse({ access_token: 'at', expires_in: 1, scope: 'openid profile' })],
    ]);
    await expect(p.exchangeCode(ctx, { code: 'c', redirectUri: 'r' })).rejects.toMatchObject({
      status: 403,
    });
  });

  test('refreshToken manda grant_type=refresh_token com as credenciais do app', async () => {
    let form: URLSearchParams | undefined;
    const ctx = route([
      [
        '/oauth/v2/accessToken',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          return jsonResponse({ access_token: 'novo', expires_in: 60, refresh_token: 'rt2' });
        },
      ],
    ]);
    const out = await p.refreshToken(ctx, 'rt1');
    expect(Object.fromEntries(form!)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'rt1',
      client_id: 'cid',
      client_secret: 'csec',
    });
    expect(out).toMatchObject({ accessToken: 'novo', refreshToken: 'rt2' });
  });
});

describe('linkedin: publicação', () => {
  test('texto puro: golden body do rest/posts + x-restli-id vira externalId', async () => {
    let postBody: any;
    const ctx = route([
      ['/v2/userinfo', () => jsonResponse(USERINFO)],
      [
        '/rest/posts',
        (b) => {
          postBody = b;
          return new Response('{}', {
            status: 201,
            headers: { 'x-restli-id': 'urn:li:share:777' },
          });
        },
      ],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'olá #linkedin', media: [] }], {});
    expect(postBody).toEqual({
      author: 'urn:li:person:AbC123',
      // caracteres reservados do formato "little" escapados
      commentary: 'olá \\#linkedin',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    });
    expect(res).toEqual({
      externalId: 'urn:li:share:777',
      releaseUrl: 'https://www.linkedin.com/feed/update/urn:li:share:777',
    });
  });

  test('1 imagem: initializeUpload → PUT bytes → AVAILABLE → content.media com altText', async () => {
    let postBody: any;
    let initBody: any;
    let putCalled = false;
    const ctx = route([
      ['/v2/userinfo', () => jsonResponse(USERINFO)],
      [
        'action=initializeUpload',
        (b) => {
          initBody = b;
          return jsonResponse({
            value: { uploadUrl: 'https://li-cdn/up/1', image: 'urn:li:image:img1' },
          });
        },
      ],
      ['https://li-cdn/up/1', () => ((putCalled = true), new Response('', { status: 201 }))],
      ['/rest/images/', () => jsonResponse({ status: 'AVAILABLE' })],
      ['https://mp/uploads/', () => new Response(new Uint8Array([9, 9]))],
      [
        '/rest/posts',
        (b) => {
          postBody = b;
          return new Response('{}', { status: 201, headers: { 'x-restli-id': 'urn:li:share:1' } });
        },
      ],
    ]);
    await p.publish(
      ctx,
      token,
      [
        {
          content: 'foto',
          media: [{ type: 'image', url: 'https://mp/uploads/a.png', mime: 'image/png', alt: 'um gato' }],
        },
      ],
      {},
    );
    expect(initBody).toEqual({ initializeUploadRequest: { owner: 'urn:li:person:AbC123' } });
    expect(putCalled).toBe(true);
    expect(postBody.content).toEqual({ media: { id: 'urn:li:image:img1', altText: 'um gato' } });
  });

  test('2+ imagens viram multiImage', async () => {
    let postBody: any;
    let n = 0;
    const ctx = route([
      ['/v2/userinfo', () => jsonResponse(USERINFO)],
      [
        'action=initializeUpload',
        () =>
          jsonResponse({
            value: { uploadUrl: `https://li-cdn/up/${n}`, image: `urn:li:image:${n++}` },
          }),
      ],
      ['https://li-cdn/up/', () => new Response('', { status: 201 })],
      ['/rest/images/', () => jsonResponse({ status: 'AVAILABLE' })],
      ['https://mp/uploads/', () => new Response(new Uint8Array([1]))],
      [
        '/rest/posts',
        (b) => {
          postBody = b;
          return new Response('{}', { status: 201, headers: { 'x-restli-id': 'urn:li:share:2' } });
        },
      ],
    ]);
    await p.publish(
      ctx,
      token,
      [
        {
          content: 'álbum',
          media: [
            { type: 'image', url: 'https://mp/uploads/a.png', mime: 'image/png' },
            { type: 'image', url: 'https://mp/uploads/b.png', mime: 'image/png' },
          ],
        },
      ],
      {},
    );
    expect(postBody.content).toEqual({
      multiImage: { images: [{ id: 'urn:li:image:0' }, { id: 'urn:li:image:1' }] },
    });
  });

  test('publishReply: comentário via socialActions no post raiz', async () => {
    let commentBody: any;
    const ctx = route([
      ['/v2/userinfo', () => jsonResponse(USERINFO)],
      [
        '/rest/socialActions/',
        (b) => {
          commentBody = b;
          return jsonResponse({
            commentUrn: 'urn:li:comment:(urn:li:share:777,42)',
            object: 'urn:li:share:777',
          });
        },
      ],
    ]);
    const res = await p.publishReply!(ctx, token, 'urn:li:share:777', {
      content: 'primeiro comentário',
      media: [],
    });
    const call = ctx.calls.find((c) => c.url.includes('/rest/socialActions/'));
    expect(call?.url).toContain(encodeURIComponent('urn:li:share:777'));
    expect(commentBody).toEqual({
      actor: 'urn:li:person:AbC123',
      object: 'urn:li:share:777',
      message: { text: 'primeiro comentário' },
    });
    expect(res.externalId).toBe('urn:li:comment:(urn:li:share:777,42)');
  });

  test('réplica de réplica volta para o post raiz (1 nível de comentário só)', async () => {
    let target = '';
    const ctx = route([
      ['/v2/userinfo', () => jsonResponse(USERINFO)],
      [
        '/rest/socialActions/',
        (b) => {
          target = b.object;
          return jsonResponse({ commentUrn: 'urn:li:comment:(urn:li:share:777,43)' });
        },
      ],
    ]);
    await p.publishReply!(ctx, token, 'urn:li:comment:(urn:li:share:777,42)', {
      content: 'segundo',
      media: [],
    });
    expect(target).toBe('urn:li:share:777');
  });
});

describe('linkedin: regras', () => {
  test('validateMedia: réplica com mídia é rejeitada (comentário é só texto)', async () => {
    const out = await p.validateMedia([
      { content: 'principal', media: [] },
      { content: 'réplica', media: [{ type: 'image', url: 'https://x/i.png', mime: 'image/png' }] },
    ]);
    expect(out.ok).toBe(false);
  });

  test('classifyError: instabilidades conhecidas da API → transient', () => {
    expect(p.classifyError(400, 'Unable to obtain activity xyz')).toBe('transient');
    expect(p.classifyError(403, 'the resource is forbidden right now')).toBe('transient');
    expect(p.classifyError(403, 'ACCESS_DENIED de verdade')).toBe('permanent');
  });
});
