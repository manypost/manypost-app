import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { threadsProvider as p } from './threads.provider';

runProviderContract(p);

const SECRETS = { appId: 'app1', appSecret: 's3cr3t' };
const token = { accessToken: 'THQVJlong', scopes: [] };
/** settings do canal (merge) — userId endereça a Graph API, username monta a URL de fallback */
const CHANNEL = { userId: '9001', username: 'criadora' };

type Form = Record<string, string>;

/** roteia por trecho da URL, na ordem declarada (a mais específica primeiro) e entrega o form já parseado. */
const route = (routes: Array<[string, (form: Form, init?: RequestInit) => Response]>) =>
  mockCtx((url, init) => {
    const form =
      init?.body === undefined
        ? {}
        : (Object.fromEntries(new URLSearchParams(String(init.body))) as Form);
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? hit[1](form, init) : jsonResponse({ error: { message: 'não mockado', url } }, 404);
  }, SECRETS);

const ME = {
  id: '9001',
  username: 'criadora',
  name: 'Criadora',
  threads_profile_picture_url: 'https://cdn.threads/av.jpg',
};

interface Capture {
  containers: Form[];
  publish?: Form;
}
const capture = (): Capture => ({ containers: [] });

/** container criado → FINISHED no 1º poll → publicado → permalink. */
const happyRoutes = (
  capture: Capture,
): Array<[string, (form: Form, init?: RequestInit) => Response]> => [
  [
    '/threads_publish',
    (f) => {
      capture.publish = f;
      return jsonResponse({ id: 'post-1' });
    },
  ],
  [
    '/threads',
    (f) => {
      capture.containers.push(f);
      return jsonResponse({ id: `cont-${capture.containers.length}` });
    },
  ],
  [
    'fields=status',
    (_f, init) => {
      void init;
      return jsonResponse({ status: 'FINISHED' });
    },
  ],
  ['permalink', () => jsonResponse({ id: 'post-1', permalink: 'https://www.threads.net/@criadora/post/abc' })],
];

describe('threads: OAuth (token curto → longo)', () => {
  test('getAuthUrl: consentimento no threads.net com escopos por vírgula', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe('https://www.threads.net/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('app1');
    expect(u.searchParams.get('redirect_uri')).toBe('https://mp/cb');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('scope')).toBe(
      'threads_basic,threads_content_publish,threads_manage_replies,threads_manage_insights',
    );
    expect(u.searchParams.get('state')).toBe(out.state);
  });

  test('exchangeCode: form golden → th_exchange_token → /me vira canal com userId nos settings', async () => {
    let codeForm: Form | undefined;
    let exchangeUrl = '';
    const ctx = route([
      [
        '/oauth/access_token',
        (f) => {
          codeForm = f;
          return jsonResponse({
            access_token: 'short',
            user_id: 9001,
            permissions: ['threads_basic', 'threads_content_publish'],
          });
        },
      ],
      [
        '/access_token',
        (_f, init) => {
          void init;
          return jsonResponse({ access_token: 'THQVJlong', expires_in: 5_184_000 });
        },
      ],
      ['/me?', () => jsonResponse(ME)],
    ]);
    // captura a URL da troca de token longo (é GET com query)
    const account = await (async () => {
      const out = await p.exchangeCode(ctx, { code: 'c0d3', redirectUri: 'https://mp/cb' });
      exchangeUrl = ctx.calls.find((c) => c.url.includes('/access_token?'))?.url ?? '';
      return out;
    })();

    expect(codeForm).toEqual({
      client_id: 'app1',
      client_secret: 's3cr3t',
      grant_type: 'authorization_code',
      redirect_uri: 'https://mp/cb',
      code: 'c0d3',
    });
    const eq = new URL(exchangeUrl).searchParams;
    expect(eq.get('grant_type')).toBe('th_exchange_token');
    expect(eq.get('client_secret')).toBe('s3cr3t');
    expect(eq.get('access_token')).toBe('short');

    expect(account).toMatchObject({
      accessToken: 'THQVJlong',
      // no Threads não há refresh token separado: o próprio token longo se renova
      refreshToken: 'THQVJlong',
      externalId: '9001',
      name: 'Criadora',
      username: 'criadora',
      avatarUrl: 'https://cdn.threads/av.jpg',
      channelSettings: { userId: '9001', username: 'criadora' },
      // ctx.now (2026-01-01T12:00Z) + 60 dias
      expiresAt: '2026-03-02T12:00:00.000Z',
    });
  });

  test('exchangeCode sem threads_content_publish → 403 legível (reconectar)', async () => {
    const ctx = route([
      [
        '/oauth/access_token',
        () => jsonResponse({ access_token: 'short', user_id: 1, permissions: ['threads_basic'] }),
      ],
      ['/access_token', () => jsonResponse({ access_token: 'long', expires_in: 100 })],
      ['/me?', () => jsonResponse(ME)],
    ]);
    await expect(p.exchangeCode(ctx, { code: 'c', redirectUri: 'https://mp/cb' })).rejects.toMatchObject({
      status: 403,
    });
  });

  test('refreshToken: th_refresh_token devolve o par novo (accessToken = refreshToken)', async () => {
    const ctx = route([
      ['/refresh_access_token', () => jsonResponse({ access_token: 'THQVJnovo', expires_in: 5_184_000 })],
    ]);
    const out = await p.refreshToken(ctx, 'THQVJvelho');
    const q = new URL(ctx.calls[0]!.url).searchParams;
    expect(q.get('grant_type')).toBe('th_refresh_token');
    expect(q.get('access_token')).toBe('THQVJvelho');
    expect(out).toMatchObject({
      accessToken: 'THQVJnovo',
      refreshToken: 'THQVJnovo',
      expiresAt: '2026-03-02T12:00:00.000Z',
    });
  });
});

describe('threads: publicação', () => {
  test('só texto: container TEXT + reply_control → publish → permalink', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    const [res] = await p.publish(ctx, token, [{ content: 'olá threads', media: [] }], {
      ...CHANNEL,
      linkAttachment: 'https://manypost.dev',
    });
    expect(cap.containers).toEqual([
      {
        access_token: 'THQVJlong',
        reply_control: 'everyone',
        media_type: 'TEXT',
        text: 'olá threads',
        link_attachment: 'https://manypost.dev',
      },
    ]);
    expect(cap.publish).toEqual({ access_token: 'THQVJlong', creation_id: 'cont-1' });
    // o container é criado em /{userId}/threads — nunca em /me quando o canal sabe o id
    expect(ctx.calls.some((c) => c.url.includes('/v1.0/9001/threads'))).toBe(true);
    expect(res).toEqual({
      externalId: 'post-1',
      releaseUrl: 'https://www.threads.net/@criadora/post/abc',
    });
  });

  test('mídia única: image_url + alt_text no mesmo container do texto', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    await p.publish(
      ctx,
      token,
      [
        {
          content: 'com foto',
          media: [{ type: 'image', url: 'https://mp/uploads/a.jpg', mime: 'image/jpeg', alt: 'gato' }],
        },
      ],
      { ...CHANNEL, replyControl: 'accounts_you_follow' },
    );
    expect(cap.containers).toEqual([
      {
        access_token: 'THQVJlong',
        reply_control: 'accounts_you_follow',
        media_type: 'IMAGE',
        image_url: 'https://mp/uploads/a.jpg',
        alt_text: 'gato',
        text: 'com foto',
      },
    ]);
  });

  test('carrossel: filhos is_carousel_item sem texto, pai CAROUSEL com children', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    await p.publish(
      ctx,
      token,
      [
        {
          content: 'álbum',
          media: [
            { type: 'image', url: 'https://mp/uploads/a.jpg', mime: 'image/jpeg' },
            { type: 'video', url: 'https://mp/uploads/v.mp4', mime: 'video/mp4' },
          ],
        },
      ],
      CHANNEL,
    );
    expect(cap.containers).toEqual([
      { access_token: 'THQVJlong', is_carousel_item: 'true', media_type: 'IMAGE', image_url: 'https://mp/uploads/a.jpg' },
      { access_token: 'THQVJlong', is_carousel_item: 'true', media_type: 'VIDEO', video_url: 'https://mp/uploads/v.mp4' },
      {
        access_token: 'THQVJlong',
        reply_control: 'everyone',
        media_type: 'CAROUSEL',
        children: 'cont-1,cont-2',
        text: 'álbum',
      },
    ]);
    expect(cap.publish).toEqual({ access_token: 'THQVJlong', creation_id: 'cont-3' });
  });

  test('publishReply: réplica nativa por reply_to_id no container', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    const res = await p.publishReply!(ctx, token, 'post-anterior', { content: 'continuando', media: [] }, CHANNEL);
    expect(cap.containers[0]).toMatchObject({
      media_type: 'TEXT',
      text: 'continuando',
      reply_to_id: 'post-anterior',
    });
    expect(res.externalId).toBe('post-1');
  });

  test('permalink indisponível NÃO derruba um post já publicado (nunca reposta)', async () => {
    const cap = capture();
    const ctx = route([
      ...happyRoutes(cap).slice(0, 3),
      ['permalink', () => jsonResponse({ error: { message: 'sem permissão' } }, 403)],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'x', media: [] }], CHANNEL);
    // cai no perfil do @handle em vez de estourar depois do threads_publish
    expect(res).toEqual({ externalId: 'post-1', releaseUrl: 'https://www.threads.net/@criadora' });
  });

  test('sem userId no canal, endereça /me (canal antigo/settings incompletos)', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    await p.publish(ctx, token, [{ content: 'x', media: [] }], {});
    expect(ctx.calls[0]!.url).toBe('https://graph.threads.net/v1.0/me/threads');
  });

  test('container ERROR → 422 (permanente, com a mensagem da Meta)', async () => {
    const cap = capture();
    const ctx = route([
      ...happyRoutes(cap).slice(0, 2),
      [
        'fields=status',
        () =>
          jsonResponse({ status: 'ERROR', error_message: 'The media could not be fetched from this URI' }),
      ],
    ]);
    await expect(
      p.publish(
        ctx,
        token,
        [{ content: 'x', media: [{ type: 'image', url: 'http://localhost/a.jpg', mime: 'image/jpeg' }] }],
        CHANNEL,
      ),
    ).rejects.toMatchObject({ status: 422, body: 'The media could not be fetched from this URI' });
  });
});

describe('threads: regras e erros', () => {
  test('validateMedia: carrossel misto passa, acima de 20 itens não', async () => {
    const mixed = [
      { type: 'image' as const, url: 'a.jpg', mime: 'image/jpeg' },
      { type: 'video' as const, url: 'v.mp4', mime: 'video/mp4' },
    ];
    expect(await p.validateMedia([{ content: 'ok', media: mixed }])).toEqual({ ok: true });
    expect(await p.validateMedia([{ content: 'só texto', media: [] }])).toEqual({ ok: true });
    const many = Array.from({ length: 21 }, (_, i) => ({
      type: 'image' as const,
      url: `a${i}.jpg`,
      mime: 'image/jpeg',
    }));
    expect(await p.validateMedia([{ content: 'demais', media: many }])).toMatchObject({ ok: false });
    // GIF/WebP não são aceitos pela Meta
    expect(
      await p.validateMedia([{ content: 'gif', media: [{ type: 'image', url: 'a.gif', mime: 'image/gif' }] }]),
    ).toMatchObject({ ok: false });
  });

  test('classifyError: token → refresh; limite/5xx → transient; restrição → permanent', () => {
    expect(p.classifyError(400, '{"error":{"message":"Error validating access token","code":190}}')).toBe(
      'refresh-token',
    );
    expect(p.classifyError(400, '{"error":{"type":"OAuthException","code":10}}')).toBe('refresh-token');
    expect(p.classifyError(400, '{"error":{"message":"Application request limit reached","code":4}}')).toBe(
      'transient',
    );
    expect(p.classifyError(400, '{"error":{"error_subcode":2207051}}')).toBe('permanent');
    expect(p.classifyError(400, '{"error":{"message":"The media could not be fetched from this URI"}}')).toBe(
      'permanent',
    );
  });

  test('capacidades: 500 chars, thread nativa e 2 jobs simultâneos', () => {
    expect(p.capabilities.maxLength()).toBe(500);
    expect(p.capabilities.threads).toBe(true);
    expect(p.rateDefaults.maxConcurrent).toBe(2);
  });
});
