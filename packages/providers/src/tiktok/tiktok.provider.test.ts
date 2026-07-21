import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { tiktokProvider as p } from './tiktok.provider';

runProviderContract(p);

const SECRETS = { clientKey: 'ck', clientSecret: 'cs' };
const token = { accessToken: 'at', refreshToken: 'rt', scopes: [] };

/** roteia por trecho da URL, na ordem declarada (a mais específica primeiro). */
const route = (routes: Array<[string, (body: any, init?: RequestInit) => Response]>) =>
  mockCtx((url, init) => {
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? hit[1](body, init) : jsonResponse({ error: { code: 'NotMocked' }, url }, 404);
  }, SECRETS);

const b64urlToBytes = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const USER = {
  data: { user: { open_id: 'oid', display_name: 'Creator', username: 'creator', avatar_url: 'https://tt/av.jpg' } },
};

describe('tiktok: OAuth2 PKCE', () => {
  test('getAuthUrl: client_key + escopos por vírgula + challenge S256 confere com o verifier', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(u.searchParams.get('client_key')).toBe('ck');
    expect(u.searchParams.get('scope')).toBe(
      'user.info.basic,user.info.profile,video.publish,video.upload',
    );
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toBe(out.state);
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(out.codeVerifier!)),
    );
    expect(b64urlToBytes(u.searchParams.get('code_challenge')!)).toEqual(digest);
  });

  test('exchangeCode: form golden + user/info → channelSettings com username', async () => {
    let form: URLSearchParams | undefined;
    const ctx = route([
      [
        '/v2/oauth/token/',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          return jsonResponse({
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 86_400,
            open_id: 'oid',
            scope: 'user.info.basic,user.info.profile,video.publish,video.upload',
          });
        },
      ],
      ['/v2/user/info/', () => jsonResponse(USER)],
    ]);
    const account = await p.exchangeCode(ctx, {
      code: 'c0d3',
      codeVerifier: 'verif',
      redirectUri: 'https://mp/cb',
    });
    expect(Object.fromEntries(form!)).toEqual({
      grant_type: 'authorization_code',
      code: 'c0d3',
      redirect_uri: 'https://mp/cb',
      code_verifier: 'verif',
      client_key: 'ck',
      client_secret: 'cs',
    });
    expect(account).toMatchObject({
      accessToken: 'at',
      refreshToken: 'rt',
      externalId: 'oid',
      name: 'Creator',
      username: 'creator',
      avatarUrl: 'https://tt/av.jpg',
      channelSettings: { username: 'creator' },
      // ctx.now (2026-01-01T12:00Z) + 24h
      expiresAt: '2026-01-02T12:00:00.000Z',
    });
  });

  test('exchangeCode sem escopo de publicação → 403 legível (reconectar)', async () => {
    const ctx = route([
      [
        '/v2/oauth/token/',
        () => jsonResponse({ access_token: 'at', expires_in: 86_400, scope: 'user.info.basic' }),
      ],
      ['/v2/user/info/', () => jsonResponse(USER)],
    ]);
    await expect(
      p.exchangeCode(ctx, { code: 'c', codeVerifier: 'v', redirectUri: 'https://mp/cb' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('refreshToken rotaciona o par (o worker persiste o novo)', async () => {
    let form: URLSearchParams | undefined;
    const ctx = route([
      [
        '/v2/oauth/token/',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          return jsonResponse({ access_token: 'at2', refresh_token: 'rt2', expires_in: 86_400 });
        },
      ],
    ]);
    const out = await p.refreshToken(ctx, 'rt1');
    expect(Object.fromEntries(form!)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'rt1',
      client_key: 'ck',
      client_secret: 'cs',
    });
    expect(out).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2' });
  });
});

describe('tiktok: publicação de vídeo (Direct Post + FILE_UPLOAD)', () => {
  test('golden do init + upload em chunk (Content-Range) + poll COMPLETE → releaseUrl com @handle', async () => {
    let initBody: any;
    let contentRange = '';
    let statusReq: any;
    const ctx = route([
      ['mp/uploads/', () => new Response(new Uint8Array([1, 2, 3]))],
      [
        '/video/init/',
        (b) => {
          initBody = b;
          return jsonResponse({
            data: { publish_id: 'pub1', upload_url: 'https://upload.tiktok.test/xyz' },
            error: { code: 'ok' },
          });
        },
      ],
      [
        'upload.tiktok.test',
        (_b, init) => {
          contentRange = ((init?.headers ?? {}) as Record<string, string>)['content-range'] ?? '';
          return new Response('', { status: 201 });
        },
      ],
      [
        '/status/fetch/',
        (b) => {
          statusReq = b;
          return jsonResponse({
            data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['777'] },
            error: { code: 'ok' },
          });
        },
      ],
    ]);
    const [res] = await p.publish(
      ctx,
      token,
      [{ content: 'meu clipe', media: [{ type: 'video', url: 'https://mp/uploads/v.mp4', mime: 'video/mp4' }] }],
      { username: 'creator' },
    );
    expect(initBody).toEqual({
      post_info: {
        title: 'meu clipe',
        privacy_level: 'SELF_ONLY',
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
        is_aigc: false,
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: { source: 'FILE_UPLOAD', video_size: 3, chunk_size: 3, total_chunk_count: 1 },
    });
    expect(contentRange).toBe('bytes 0-2/3');
    expect(statusReq).toEqual({ publish_id: 'pub1' });
    expect(res).toEqual({ externalId: '777', releaseUrl: 'https://www.tiktok.com/@creator/video/777' });
  });

  test('settings do composer viram flags de compliance (privacy/duet/stitch/brand/aigc)', async () => {
    let initBody: any;
    const ctx = route([
      ['mp/uploads/', () => new Response(new Uint8Array([9]))],
      [
        '/video/init/',
        (b) => {
          initBody = b;
          return jsonResponse({ data: { publish_id: 'pub2', upload_url: 'https://upload.tiktok.test/z' } });
        },
      ],
      ['upload.tiktok.test', () => new Response('', { status: 201 })],
      ['/status/fetch/', () => jsonResponse({ data: { status: 'PUBLISH_COMPLETE' } })],
    ]);
    const [res] = await p.publish(
      ctx,
      token,
      [{ content: 'clipe', media: [{ type: 'video', url: 'https://mp/uploads/v.mp4', mime: 'video/mp4' }] }],
      {
        username: 'creator',
        privacyLevel: 'PUBLIC_TO_EVERYONE',
        disableComment: true,
        disableDuet: true,
        disableStitch: true,
        videoMadeWithAi: true,
        brandContentToggle: true,
      },
    );
    expect(initBody.post_info).toEqual({
      title: 'clipe',
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_comment: true,
      disable_duet: true,
      disable_stitch: true,
      is_aigc: true,
      brand_content_toggle: true,
      brand_organic_toggle: false,
    });
    // sem publicaly_available_post_id (post privado) → cai no perfil do @handle
    expect(res).toEqual({ externalId: 'pub2', releaseUrl: 'https://www.tiktok.com/@creator' });
  });

  test('status FAILED → erro permanent (422)', async () => {
    const ctx = route([
      ['mp/uploads/', () => new Response(new Uint8Array([1]))],
      ['/video/init/', () => jsonResponse({ data: { publish_id: 'p', upload_url: 'https://upload.tiktok.test/a' } })],
      ['upload.tiktok.test', () => new Response('', { status: 201 })],
      ['/status/fetch/', () => jsonResponse({ data: { status: 'FAILED', fail_reason: 'spam_risk' } })],
    ]);
    await expect(
      p.publish(
        ctx,
        token,
        [{ content: 'x', media: [{ type: 'video', url: 'https://mp/uploads/v.mp4', mime: 'video/mp4' }] }],
        {},
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('tiktok: publicação de foto e inbox', () => {
  test('foto: PULL_FROM_URL com photo_images + description (Direct Post)', async () => {
    let initBody: any;
    let initUrl = '';
    const ctx = route([
      [
        '/content/init/',
        (b, init) => {
          initBody = b;
          initUrl = 'content/init';
          void init;
          return jsonResponse({ data: { publish_id: 'ph1' } });
        },
      ],
      ['/status/fetch/', () => jsonResponse({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['888'] } })],
    ]);
    const [res] = await p.publish(
      ctx,
      token,
      [
        {
          content: 'minha foto',
          media: [
            { type: 'image', url: 'https://mp/uploads/a.jpg', mime: 'image/jpeg' },
            { type: 'image', url: 'https://mp/uploads/b.jpg', mime: 'image/jpeg' },
          ],
        },
      ],
      { username: 'creator', privacyLevel: 'PUBLIC_TO_EVERYONE' },
    );
    expect(initUrl).toBe('content/init');
    expect(initBody).toEqual({
      post_info: {
        description: 'minha foto',
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: false,
        brand_content_toggle: false,
        brand_organic_toggle: false,
        auto_add_music: false,
      },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: ['https://mp/uploads/a.jpg', 'https://mp/uploads/b.jpg'],
      },
    });
    expect(res).toEqual({ externalId: '888', releaseUrl: 'https://www.tiktok.com/@creator/video/888' });
  });

  test('UPLOAD (inbox): vídeo vai p/ o rascunho no app → SEND_TO_USER_INBOX', async () => {
    let initUrl = '';
    let initBody: any;
    const ctx = route([
      ['mp/uploads/', () => new Response(new Uint8Array([1, 1]))],
      [
        '/inbox/video/init/',
        (b) => {
          initUrl = 'inbox';
          initBody = b;
          return jsonResponse({ data: { publish_id: 'pub9', upload_url: 'https://upload.tiktok.test/i' } });
        },
      ],
      ['upload.tiktok.test', () => new Response('', { status: 201 })],
      ['/status/fetch/', () => jsonResponse({ data: { status: 'SEND_TO_USER_INBOX' } })],
    ]);
    const [res] = await p.publish(
      ctx,
      token,
      [{ content: 'clipe inbox', media: [{ type: 'video', url: 'https://mp/uploads/v.mp4', mime: 'video/mp4' }] }],
      { contentPostingMethod: 'UPLOAD' },
    );
    expect(initUrl).toBe('inbox');
    expect(initBody).toEqual({
      post_info: { title: 'clipe inbox' },
      source_info: { source: 'FILE_UPLOAD', video_size: 2, chunk_size: 2, total_chunk_count: 1 },
    });
    expect(res).toEqual({ externalId: 'pub9', releaseUrl: 'https://www.tiktok.com/' });
  });
});

describe('tiktok: regras e erros', () => {
  test('validateMedia: exige mídia, rejeita mistura e vídeo além de 1', async () => {
    expect(await p.validateMedia([{ content: 'só texto', media: [] }])).toMatchObject({ ok: false });
    expect(
      await p.validateMedia([
        {
          content: 'mistura',
          media: [
            { type: 'video', url: 'v.mp4', mime: 'video/mp4' },
            { type: 'image', url: 'a.jpg', mime: 'image/jpeg' },
          ],
        },
      ]),
    ).toMatchObject({ ok: false });
    expect(
      await p.validateMedia([
        {
          content: '2 videos',
          media: [
            { type: 'video', url: 'v1.mp4', mime: 'video/mp4' },
            { type: 'video', url: 'v2.mp4', mime: 'video/mp4' },
          ],
        },
      ]),
    ).toMatchObject({ ok: false });
    expect(
      await p.validateMedia([
        { content: 'ok', media: [{ type: 'video', url: 'v.mp4', mime: 'video/mp4' }] },
      ]),
    ).toEqual({ ok: true });
  });

  test('classifyError: token inválido → refresh; rate/5xx → transient; spam/formato → permanent', () => {
    expect(p.classifyError(200, '{"error":{"code":"access_token_invalid"}}')).toBe('refresh-token');
    expect(p.classifyError(200, '{"error":{"code":"scope_not_authorized"}}')).toBe('refresh-token');
    expect(p.classifyError(200, '{"error":{"code":"rate_limit_exceeded"}}')).toBe('transient');
    expect(p.classifyError(200, '{"error":{"code":"internal_error"}}')).toBe('transient');
    expect(p.classifyError(200, '{"error":{"code":"spam_risk_too_many_posts"}}')).toBe('permanent');
    expect(p.classifyError(200, '{"error":{"code":"url_ownership_unverified"}}')).toBe('permanent');
  });
});
