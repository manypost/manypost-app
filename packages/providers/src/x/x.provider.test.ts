import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { xProvider as p } from './x.provider';

runProviderContract(p);

const SECRETS = { clientId: 'cid', clientSecret: 'csec' };
const token = { accessToken: 'at', refreshToken: 'rt', scopes: [] };
const ME = {
  data: {
    id: '99',
    name: 'Fulana',
    username: 'fulana',
    profile_image_url: 'https://x/av.jpg',
    verified: true,
  },
};

/** roteia por trecho da URL, na ordem declarada (a mais específica primeiro). */
const route = (routes: Array<[string, (body: any, init?: RequestInit) => Response]>) =>
  mockCtx((url, init) => {
    const body =
      init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? hit[1](body, init) : jsonResponse({ error: 'NotMocked', url }, 404);
  }, SECRETS);

const b64urlToBytes = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

describe('x: OAuth2 PKCE', () => {
  test('getAuthUrl: challenge S256 confere com o codeVerifier devolvido', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe('https://x.com/i/oauth2/authorize');
    expect(u.searchParams.get('client_id')).toBe('cid');
    expect(u.searchParams.get('scope')).toBe(
      'tweet.read tweet.write users.read media.write offline.access',
    );
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toBe(out.state);
    // recomputa o S256 do verifier e compara com o challenge da URL
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(out.codeVerifier!)),
    );
    expect(b64urlToBytes(u.searchParams.get('code_challenge')!)).toEqual(digest);
  });

  test('exchangeCode: Basic auth + form golden + users/me → channelSettings', async () => {
    let form: URLSearchParams | undefined;
    let authz = '';
    const ctx = route([
      [
        '/2/oauth2/token',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          authz = ((init?.headers ?? {}) as Record<string, string>).authorization ?? '';
          return jsonResponse({
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 7200,
            scope: 'tweet.read tweet.write users.read media.write offline.access',
          });
        },
      ],
      ['/2/users/me', () => jsonResponse(ME)],
    ]);
    const account = await p.exchangeCode(ctx, {
      code: 'c0d3',
      codeVerifier: 'verif',
      redirectUri: 'https://mp/cb',
    });
    expect(authz).toBe(`Basic ${btoa('cid:csec')}`);
    expect(Object.fromEntries(form!)).toEqual({
      grant_type: 'authorization_code',
      code: 'c0d3',
      redirect_uri: 'https://mp/cb',
      code_verifier: 'verif',
      client_id: 'cid',
    });
    expect(account).toMatchObject({
      accessToken: 'at',
      refreshToken: 'rt',
      externalId: '99',
      name: 'Fulana',
      username: 'fulana',
      avatarUrl: 'https://x/av.jpg',
      channelSettings: { username: 'fulana', verified: true },
      // ctx.now (2026-01-01T12:00Z) + 2h
      expiresAt: '2026-01-01T14:00:00.000Z',
    });
  });

  test('refreshToken rotaciona o par (o worker persiste o novo)', async () => {
    let form: URLSearchParams | undefined;
    const ctx = route([
      [
        '/2/oauth2/token',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          return jsonResponse({ access_token: 'at2', refresh_token: 'rt2', expires_in: 7200 });
        },
      ],
    ]);
    const out = await p.refreshToken(ctx, 'rt1');
    expect(Object.fromEntries(form!)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'rt1',
      client_id: 'cid',
    });
    expect(out).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2' });
  });
});

describe('x: publicação', () => {
  test('texto puro: golden body do POST /2/tweets + releaseUrl com o handle do canal', async () => {
    let tweetBody: any;
    const ctx = route([
      [
        '/2/tweets',
        (b) => {
          tweetBody = b;
          return jsonResponse({ data: { id: '111' } });
        },
      ],
    ]);
    // settings do canal (username) + da publicação (replySettings) já chegam mesclados
    const [res] = await p.publish(ctx, token, [{ content: 'olá x', media: [] }], {
      username: 'fulana',
      verified: true,
      replySettings: 'following',
    });
    expect(tweetBody).toEqual({ text: 'olá x', reply_settings: 'following' });
    expect(res).toEqual({
      externalId: '111',
      releaseUrl: 'https://x.com/fulana/status/111',
    });
  });

  test('imagem: initialize → append → finalize → media_ids no tweet + alt best-effort', async () => {
    let initBody: any;
    let segIndex = '';
    let finalized = false;
    let metaBody: any;
    let tweetBody: any;
    const ctx = route([
      ['https://mp/uploads/', () => new Response(new Uint8Array([7, 7, 7]))],
      [
        '/2/media/upload/initialize',
        (b) => {
          initBody = b;
          return jsonResponse({ data: { id: 'm1' } });
        },
      ],
      [
        '/append',
        (_b, init) => {
          segIndex = String((init?.body as FormData).get('segment_index'));
          return new Response('', { status: 204 });
        },
      ],
      [
        '/finalize',
        () => {
          finalized = true;
          return jsonResponse({ data: { id: 'm1' } }); // imagem: sem processing_info
        },
      ],
      [
        '/2/media/metadata',
        (b) => {
          metaBody = b;
          return jsonResponse({});
        },
      ],
      [
        '/2/tweets',
        (b) => {
          tweetBody = b;
          return jsonResponse({ data: { id: '222' } });
        },
      ],
    ]);
    const [res] = await p.publish(
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
    expect(initBody).toEqual({
      media_type: 'image/png',
      total_bytes: 3,
      media_category: 'tweet_image',
    });
    expect(segIndex).toBe('0');
    expect(finalized).toBe(true);
    expect(metaBody).toEqual({ id: 'm1', metadata: { alt_text: { text: 'um gato' } } });
    expect(tweetBody).toEqual({ text: 'foto', media: { media_ids: ['m1'] } });
    expect(res?.releaseUrl).toBe('https://x.com/i/web/status/222');
  });

  test('vídeo: espera o processamento (poll STATUS) antes de tuitar', async () => {
    let polls = 0;
    const ctx = route([
      ['https://mp/uploads/', () => new Response(new Uint8Array([1]))],
      ['/2/media/upload/initialize', (b) => {
        expect(b.media_category).toBe('tweet_video');
        return jsonResponse({ data: { id: 'v1' } });
      }],
      ['/append', () => new Response('', { status: 204 })],
      [
        '/finalize',
        () =>
          jsonResponse({
            data: { id: 'v1', processing_info: { state: 'pending', check_after_secs: 0 } },
          }),
      ],
      [
        'command=STATUS',
        () =>
          jsonResponse({
            data: {
              processing_info:
                ++polls < 2 ? { state: 'in_progress', check_after_secs: 0 } : { state: 'succeeded' },
            },
          }),
      ],
      ['/2/tweets', () => jsonResponse({ data: { id: '333' } })],
    ]);
    await p.publish(
      ctx,
      token,
      [{ content: 'clipe', media: [{ type: 'video', url: 'https://mp/uploads/v.mp4', mime: 'video/mp4' }] }],
      {},
    );
    expect(polls).toBe(2);
  });

  test('processamento falhou → erro permanent (422) apontando a mídia', async () => {
    const ctx = route([
      ['https://mp/uploads/', () => new Response(new Uint8Array([1]))],
      ['/2/media/upload/initialize', () => jsonResponse({ data: { id: 'v1' } })],
      ['/append', () => new Response('', { status: 204 })],
      [
        '/finalize',
        () => jsonResponse({ data: { id: 'v1', processing_info: { state: 'failed' } } }),
      ],
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

  test('publishReply encadeia com in_reply_to_tweet_id (sem reply_settings)', async () => {
    let tweetBody: any;
    const ctx = route([
      [
        '/2/tweets',
        (b) => {
          tweetBody = b;
          return jsonResponse({ data: { id: '444' } });
        },
      ],
    ]);
    await p.publishReply!(ctx, token, '111', { content: 'resposta', media: [] }, {
      replySettings: 'following',
    });
    expect(tweetBody).toEqual({ text: 'resposta', reply: { in_reply_to_tweet_id: '111' } });
  });
});

describe('x: regras', () => {
  test('maxLength: 280 por padrão, 4000 p/ conta verified (Premium)', () => {
    expect(p.capabilities.maxLength(undefined)).toBe(280);
    expect(p.capabilities.maxLength({ verified: false })).toBe(280);
    expect(p.capabilities.maxLength({ verified: true })).toBe(4000);
  });

  test('classifyError: Unsupported Authentication → refresh-token (reconectar)', () => {
    expect(p.classifyError(403, 'Unsupported Authentication: ...')).toBe('refresh-token');
    expect(p.classifyError(403, 'duplicate content')).toBe('permanent');
  });
});
