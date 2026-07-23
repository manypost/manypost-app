import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { facebookProvider as p } from './facebook.provider';

runProviderContract(p);

const SECRETS = { appId: 'fb-app', appSecret: 's3cr3t' };
const token = { accessToken: 'USERlong', scopes: [] };
/** settings da publicação: pageId escolhido por post (SubAccountsField), postType feed por padrão */
const FEED = { pageId: '111', postType: 'feed' as const };

type Body = Record<string, unknown>;

/** roteia por trecho da URL (a rota mais específica primeiro) e entrega o corpo JSON já parseado. */
const route = (routes: Array<[string, (body: Body, init?: RequestInit) => Response]>) =>
  mockCtx((url, init) => {
    let body: Body = {};
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body) as Body;
      } catch {
        body = {};
      }
    }
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? hit[1](body, init) : jsonResponse({ error: { message: 'não mockado', url } }, 404);
  }, SECRETS);

/** rota do token da Página (derivado do token do usuário) — presente em todo publish. */
const pageTokenRoute: [string, (body: Body) => Response] = [
  '/111?',
  () => jsonResponse({ access_token: 'PAGEtok' }),
];

const img = (url = 'https://mp/uploads/a.jpg'): MediaRefLike => ({ type: 'image', url, mime: 'image/jpeg' });
const vid = (url = 'https://mp/uploads/v.mp4'): MediaRefLike => ({ type: 'video', url, mime: 'video/mp4' });
type MediaRefLike = { type: 'image' | 'video'; url: string; mime: string };

interface Capture {
  photos: Body[];
  feeds: Body[];
  videos: Body[];
  comments: Body[];
}
const capture = (): Capture => ({ photos: [], feeds: [], videos: [], comments: [] });

describe('facebook: OAuth (Facebook Login, token curto → longo)', () => {
  test('getAuthUrl: consentimento no facebook.com com escopos de Página por vírgula', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/v20.0/dialog/oauth');
    expect(u.searchParams.get('client_id')).toBe('fb-app');
    expect(u.searchParams.get('redirect_uri')).toBe('https://mp/cb');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('scope')).toContain('pages_manage_posts');
    expect(u.searchParams.get('state')).toBe(out.state);
  });

  test('exchangeCode: curto → fb_exchange_token → permissões → /me vira canal do usuário', async () => {
    const ctx = route([
      ['/me/permissions', () => jsonResponse({ data: [{ permission: 'pages_manage_posts', status: 'granted' }] })],
      [
        '/me?',
        () => jsonResponse({ id: '999', name: 'João Silva', picture: { data: { url: 'https://cdn.fb/av.jpg' } } }),
      ],
      // ambas as trocas de token batem em /oauth/access_token; a query as distingue (code vs. fb_exchange_token)
      ['/oauth/access_token', () => jsonResponse({ access_token: 'GRANT', expires_in: 5_184_000 })],
    ]);
    const account = await p.exchangeCode(ctx, { code: 'c0d3', redirectUri: 'https://mp/cb' });

    // a 1ª chamada troca o code; a 2ª faz fb_exchange_token
    const tokenCalls = ctx.calls.filter((c) => c.url.includes('/oauth/access_token'));
    expect(tokenCalls[0]!.url).toContain('code=c0d3');
    expect(tokenCalls[1]!.url).toContain('grant_type=fb_exchange_token');
    expect(tokenCalls[1]!.url).toContain('fb_exchange_token=GRANT');

    expect(account).toMatchObject({
      accessToken: 'GRANT',
      // no Facebook Login não há refresh token separado: o token longo se reapresenta para renovar
      refreshToken: 'GRANT',
      externalId: '999',
      name: 'João Silva',
      avatarUrl: 'https://cdn.fb/av.jpg',
      channelSettings: { userId: '999' },
      // ctx.now (2026-01-01T12:00Z) + 60 dias
      expiresAt: '2026-03-02T12:00:00.000Z',
    });
  });

  test('exchangeCode sem pages_manage_posts concedido → 403 legível (reconectar)', async () => {
    const ctx = route([
      ['/me/permissions', () => jsonResponse({ data: [{ permission: 'pages_show_list', status: 'granted' }] })],
      ['/me?', () => jsonResponse({ id: '1', name: 'X' })],
      ['/oauth/access_token', () => jsonResponse({ access_token: 'GRANT', expires_in: 100 })],
    ]);
    await expect(p.exchangeCode(ctx, { code: 'c', redirectUri: 'https://mp/cb' })).rejects.toMatchObject({
      status: 403,
    });
  });

  test('refreshToken: fb_exchange_token devolve novo token longo (accessToken = refreshToken)', async () => {
    const ctx = route([['/oauth/access_token', () => jsonResponse({ access_token: 'RENOVADO', expires_in: 5_184_000 })]]);
    const out = await p.refreshToken(ctx, 'USERvelho');
    const q = new URL(ctx.calls[0]!.url).searchParams;
    expect(q.get('grant_type')).toBe('fb_exchange_token');
    expect(q.get('fb_exchange_token')).toBe('USERvelho');
    expect(out).toMatchObject({
      accessToken: 'RENOVADO',
      refreshToken: 'RENOVADO',
      expiresAt: '2026-03-02T12:00:00.000Z',
    });
  });
});

describe('facebook: sub-contas (Páginas)', () => {
  test('listSubAccounts: /me/accounts + Business Manager, dedup, só o pageId em channelSettings', async () => {
    const ctx = route([
      [
        '/me/accounts',
        () =>
          jsonResponse({
            data: [
              { id: '111', name: 'Minha Página', username: 'minha', picture: { data: { url: 'https://cdn/p.jpg' } } },
            ],
          }),
      ],
      ['/me/businesses', () => jsonResponse({ data: [{ id: 'biz1' }] })],
      // a Página 111 reaparece via owned_pages (dedup) + uma nova 222 via client_pages
      ['/owned_pages', () => jsonResponse({ data: [{ id: '111', name: 'Minha Página' }] })],
      ['/client_pages', () => jsonResponse({ data: [{ id: '222', name: 'Página Cliente' }] })],
    ]);
    const subs = await p.listSubAccounts!(ctx, { ...token, externalId: '999', name: 'João', channelSettings: {} });
    expect(subs).toEqual([
      {
        externalId: '111',
        name: 'Minha Página',
        username: 'minha',
        avatarUrl: 'https://cdn/p.jpg',
        channelSettings: { pageId: '111' },
      },
      { externalId: '222', name: 'Página Cliente', channelSettings: { pageId: '222' } },
    ]);
    // o token da Página NUNCA vai para channelSettings (é segredo, seria gravado em jsonb sem cifra)
    expect(JSON.stringify(subs)).not.toContain('access_token');
  });

  test('listSubAccounts: Business Manager sem business_management (erro) não derruba /me/accounts', async () => {
    const ctx = route([
      ['/me/accounts', () => jsonResponse({ data: [{ id: '111', name: 'Só essa' }] })],
      ['/me/businesses', () => jsonResponse({ error: { message: 'sem permissão', code: 200 } }, 400)],
    ]);
    const subs = await p.listSubAccounts!(ctx, { ...token, externalId: '999', name: 'João', channelSettings: {} });
    expect(subs).toEqual([{ externalId: '111', name: 'Só essa', channelSettings: { pageId: '111' } }]);
  });
});

describe('facebook: publicação no feed', () => {
  test('texto puro: /feed com message, sem attached_media, token da Página', async () => {
    const cap = capture();
    const ctx = route([
      pageTokenRoute,
      [
        '/111/feed',
        (b) => {
          cap.feeds.push(b);
          return jsonResponse({ id: 'post-1', permalink_url: 'https://www.facebook.com/post-1' });
        },
      ],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'olá página', media: [] }], FEED);
    expect(cap.feeds).toEqual([{ message: 'olá página', published: true }]);
    // o /feed usa o token da PÁGINA (derivado), não o do usuário
    expect(ctx.calls.find((c) => c.url.includes('/111/feed'))?.url).toContain('access_token=PAGEtok');
    expect(res).toEqual({ externalId: 'post-1', releaseUrl: 'https://www.facebook.com/post-1' });
  });

  test('álbum de fotos: cada foto sobe published:false → /feed com attached_media', async () => {
    const cap = capture();
    let photoN = 0;
    const ctx = route([
      pageTokenRoute,
      [
        '/111/photos',
        (b) => {
          cap.photos.push(b);
          return jsonResponse({ id: `ph-${++photoN}` });
        },
      ],
      [
        '/111/feed',
        (b) => {
          cap.feeds.push(b);
          return jsonResponse({ id: 'post-2', permalink_url: 'https://fb/post-2' });
        },
      ],
    ]);
    await p.publish(ctx, token, [{ content: 'álbum', media: [img('https://mp/a.jpg'), img('https://mp/b.jpg')] }], FEED);
    expect(cap.photos).toEqual([
      { url: 'https://mp/a.jpg', published: false },
      { url: 'https://mp/b.jpg', published: false },
    ]);
    expect(cap.feeds).toEqual([
      { message: 'álbum', attached_media: [{ media_fbid: 'ph-1' }, { media_fbid: 'ph-2' }], published: true },
    ]);
  });

  test('vídeo único no feed = reel: /videos com file_url + description', async () => {
    const cap = capture();
    const ctx = route([
      pageTokenRoute,
      [
        '/111/videos',
        (b) => {
          cap.videos.push(b);
          return jsonResponse({ id: 'vid-1', permalink_url: 'https://www.facebook.com/reel/vid-1' });
        },
      ],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'meu reel', media: [vid()] }], FEED);
    expect(cap.videos).toEqual([{ file_url: 'https://mp/uploads/v.mp4', description: 'meu reel', published: true }]);
    expect(res).toEqual({ externalId: 'vid-1', releaseUrl: 'https://www.facebook.com/reel/vid-1' });
  });

  test('sem pageId no settings → 422 antes de qualquer chamada', async () => {
    const ctx = route([pageTokenRoute]);
    await expect(p.publish(ctx, token, [{ content: 'x', media: [] }], { postType: 'feed' })).rejects.toMatchObject({
      status: 422,
    });
    expect(ctx.calls).toEqual([]);
  });
});

describe('facebook: stories', () => {
  test('story de foto: /photos published:false → /photo_stories', async () => {
    const cap = capture();
    const ctx = route([
      pageTokenRoute,
      [
        '/111/photos',
        (b) => {
          cap.photos.push(b);
          return jsonResponse({ id: 'ph-9' });
        },
      ],
      ['/photo_stories', () => jsonResponse({ post_id: 'story-1' })],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'ignorado', media: [img()] }], { pageId: '111', postType: 'story' });
    expect(cap.photos).toEqual([{ url: 'https://mp/uploads/a.jpg', published: false }]);
    // a foto vira story por photo_id na query
    expect(ctx.calls.find((c) => c.url.includes('/photo_stories'))?.url).toContain('photo_id=ph-9');
    expect(res).toEqual({ externalId: 'story-1', releaseUrl: 'https://www.facebook.com/stories/story-1' });
  });

  test('story de vídeo em fases: start → upload hospedado → poll ready → finish', async () => {
    const ctx = route([
      pageTokenRoute,
      ['upload_phase=start', () => jsonResponse({ video_id: 'v99', upload_url: 'https://rupload.fb/v99' })],
      ['rupload.fb', () => jsonResponse({ success: true })],
      ['/v99?', () => jsonResponse({ status: { video_status: 'ready' } })],
      ['upload_phase=finish', () => jsonResponse({ post_id: 'story-v' })],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'x', media: [vid()] }], { pageId: '111', postType: 'story' });
    // o upload hospedado manda file_url no header (a Meta puxa a mídia)
    const upload = ctx.calls.find((c) => c.url.includes('rupload.fb'));
    expect((upload?.init?.headers as Record<string, string>).file_url).toBe('https://mp/uploads/v.mp4');
    expect(res).toEqual({ externalId: 'story-v', releaseUrl: 'https://www.facebook.com/stories/story-v' });
  });

  test('story com mais de uma mídia → 422 (não publica parcial)', async () => {
    const ctx = route([pageTokenRoute]);
    await expect(
      p.publish(ctx, token, [{ content: 'x', media: [img(), img('https://mp/b.jpg')] }], { pageId: '111', postType: 'story' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  test('story sem mídia → 422 (o story exige foto ou vídeo)', async () => {
    const ctx = route([pageTokenRoute]);
    await expect(p.publish(ctx, token, [{ content: 'x', media: [] }], { pageId: '111', postType: 'story' })).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('facebook: réplicas (comentários) e regras', () => {
  test('publishReply: comentário no post raiz com o token da Página; foto vira attachment_url', async () => {
    const cap = capture();
    const ctx = route([
      pageTokenRoute,
      [
        '/post-raiz/comments',
        (b) => {
          cap.comments.push(b);
          return jsonResponse({ id: 'comment-1', permalink_url: 'https://fb/c1' });
        },
      ],
    ]);
    const res = await p.publishReply!(ctx, token, 'post-raiz', { content: 'complemento', media: [img()] }, FEED);
    expect(cap.comments).toEqual([{ message: 'complemento', attachment_url: 'https://mp/uploads/a.jpg' }]);
    expect(res).toEqual({ externalId: 'comment-1', releaseUrl: 'https://fb/c1' });
  });

  test('validateMedia: feed aceita álbum/1 vídeo sem misturar; comentário só texto/1 foto', async () => {
    // texto puro no feed passa (o Facebook aceita só-texto)
    expect(await p.validateMedia([{ content: 'só texto', media: [] }])).toEqual({ ok: true });
    // álbum de 10 fotos passa; 11 não
    const ten = Array.from({ length: 10 }, (_, i) => img(`a${i}.jpg`));
    expect(await p.validateMedia([{ content: 'ok', media: ten }])).toEqual({ ok: true });
    expect(await p.validateMedia([{ content: 'demais', media: [...ten, img('x.jpg')] }])).toMatchObject({ ok: false });
    // misturar foto e vídeo no feed é barrado
    expect(await p.validateMedia([{ content: 'misto', media: [img(), vid()] }])).toMatchObject({ ok: false });
    // comentário (item 1) com vídeo é barrado; com 2 fotos também; com 1 foto passa
    expect(
      await p.validateMedia([
        { content: 'p', media: [img()] },
        { content: 'c', media: [vid()] },
      ]),
    ).toMatchObject({ ok: false });
    expect(
      await p.validateMedia([
        { content: 'p', media: [img()] },
        { content: 'c', media: [img(), img('b.jpg')] },
      ]),
    ).toMatchObject({ ok: false });
    expect(
      await p.validateMedia([
        { content: 'p', media: [img()] },
        { content: 'c', media: [img()] },
      ]),
    ).toEqual({ ok: true });
  });

  test('classifyError: token → refresh; too-fast/5xx/instabilidade → transient; política → permanent', () => {
    expect(p.classifyError(400, '{"error":{"message":"Error validating access token","code":190}}')).toBe('refresh-token');
    expect(p.classifyError(400, '{"error":{"message":"...","code":1404078}}')).toBe('refresh-token');
    expect(p.classifyError(400, '{"error":{"message":"posting too fast","code":1390008}}')).toBe('transient');
    expect(p.classifyError(400, '{"error":{"message":"An unknown error occurred","code":1}}')).toBe('transient');
    // violação de política / arquivo inválido → permanente
    expect(p.classifyError(400, '{"error":{"message":"Content violates","code":1404102}}')).toBe('permanent');
    expect(p.classifyError(400, '{"error":{"message":"Invalid file","code":2069019}}')).toBe('permanent');
  });

  test('capacidades: 63206 chars, aceita só-texto, réplica por comentário, álbum de 10', () => {
    expect(p.capabilities.maxLength()).toBe(63206);
    expect(p.capabilities.requiresMedia).toBe(false);
    expect(p.capabilities.threads).toBe(true);
    expect(p.capabilities.media.images.maxCount).toBe(10);
    expect(p.capabilities.media.videos.maxCount).toBe(1);
  });
});
