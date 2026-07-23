import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { instagramStandaloneProvider as p } from './instagram-standalone.provider';

runProviderContract(p);

const SECRETS = { appId: 'ig-app', appSecret: 's3cr3t' };
const token = { accessToken: 'IGQlong', scopes: [] };
/** settings do canal (merge) — userId endereça a Graph API, username monta a URL de fallback */
const CHANNEL = { userId: '17841', username: 'criadora' };

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
  user_id: '17841',
  username: 'criadora',
  name: 'Criadora',
  profile_picture_url: 'https://cdn.ig/av.jpg',
};

interface Capture {
  containers: Form[];
  publishes: Form[];
}
const capture = (): Capture => ({ containers: [], publishes: [] });

/** container criado → FINISHED no 1º poll → publicado → permalink. */
const happyRoutes = (
  cap: Capture,
): Array<[string, (form: Form, init?: RequestInit) => Response]> => [
  [
    '/media_publish',
    (f) => {
      cap.publishes.push(f);
      return jsonResponse({ id: `post-${cap.publishes.length}` });
    },
  ],
  [
    '/media',
    (f) => {
      cap.containers.push(f);
      return jsonResponse({ id: `cont-${cap.containers.length}` });
    },
  ],
  ['fields=status_code', () => jsonResponse({ status_code: 'FINISHED' })],
  ['permalink', () => jsonResponse({ permalink: 'https://www.instagram.com/p/abc/' })],
];

const img = (url = 'https://mp/uploads/a.jpg'): MediaRefLike => ({ type: 'image', url, mime: 'image/jpeg' });
const vid = (url = 'https://mp/uploads/v.mp4'): MediaRefLike => ({ type: 'video', url, mime: 'video/mp4' });
type MediaRefLike = { type: 'image' | 'video'; url: string; mime: string };

describe('instagram-standalone: OAuth (Instagram Login, token curto → longo)', () => {
  test('getAuthUrl: consentimento no instagram.com com escopos business por vírgula', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(u.searchParams.get('enable_fb_login')).toBe('0');
    expect(u.searchParams.get('client_id')).toBe('ig-app');
    expect(u.searchParams.get('redirect_uri')).toBe('https://mp/cb');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('scope')).toBe(
      'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_insights',
    );
    expect(u.searchParams.get('state')).toBe(out.state);
  });

  test('exchangeCode: form golden → ig_exchange_token → /me vira canal com userId nos settings', async () => {
    let codeForm: Form | undefined;
    const ctx = route([
      [
        // o token curto vem do endpoint próprio api.instagram.com (não da Graph)
        'api.instagram.com/oauth/access_token',
        (f) => {
          codeForm = f;
          return jsonResponse({
            access_token: 'short',
            user_id: 17841,
            permissions: ['instagram_business_basic', 'instagram_business_content_publish'],
          });
        },
      ],
      ['/access_token', () => jsonResponse({ access_token: 'IGQlong', expires_in: 5_184_000 })],
      ['/me?', () => jsonResponse(ME)],
    ]);
    const account = await p.exchangeCode(ctx, { code: 'c0d3', redirectUri: 'https://mp/cb' });
    const exchangeUrl = ctx.calls.find((c) => c.url.includes('graph.instagram.com/access_token?'))?.url ?? '';

    expect(codeForm).toEqual({
      client_id: 'ig-app',
      client_secret: 's3cr3t',
      grant_type: 'authorization_code',
      redirect_uri: 'https://mp/cb',
      code: 'c0d3',
    });
    const eq = new URL(exchangeUrl).searchParams;
    expect(eq.get('grant_type')).toBe('ig_exchange_token');
    expect(eq.get('client_secret')).toBe('s3cr3t');
    expect(eq.get('access_token')).toBe('short');

    expect(account).toMatchObject({
      accessToken: 'IGQlong',
      // no Instagram Login não há refresh token separado: o próprio token longo se renova
      refreshToken: 'IGQlong',
      externalId: '17841',
      name: 'Criadora',
      username: 'criadora',
      avatarUrl: 'https://cdn.ig/av.jpg',
      channelSettings: { userId: '17841', username: 'criadora' },
      // ctx.now (2026-01-01T12:00Z) + 60 dias
      expiresAt: '2026-03-02T12:00:00.000Z',
    });
  });

  test('exchangeCode sem instagram_business_content_publish → 403 legível (reconectar)', async () => {
    const ctx = route([
      [
        'api.instagram.com/oauth/access_token',
        () => jsonResponse({ access_token: 'short', user_id: 1, permissions: ['instagram_business_basic'] }),
      ],
      ['/access_token', () => jsonResponse({ access_token: 'long', expires_in: 100 })],
      ['/me?', () => jsonResponse(ME)],
    ]);
    await expect(
      p.exchangeCode(ctx, { code: 'c', redirectUri: 'https://mp/cb' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('refreshToken: ig_refresh_token devolve o par novo (accessToken = refreshToken)', async () => {
    const ctx = route([
      ['/refresh_access_token', () => jsonResponse({ access_token: 'IGQnovo', expires_in: 5_184_000 })],
    ]);
    const out = await p.refreshToken(ctx, 'IGQvelho');
    const q = new URL(ctx.calls[0]!.url).searchParams;
    expect(q.get('grant_type')).toBe('ig_refresh_token');
    expect(q.get('access_token')).toBe('IGQvelho');
    expect(out).toMatchObject({
      accessToken: 'IGQnovo',
      refreshToken: 'IGQnovo',
      expiresAt: '2026-03-02T12:00:00.000Z',
    });
  });
});

describe('instagram-standalone: publicação', () => {
  test('foto única no feed: image_url + caption no container → media_publish → permalink', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    const [res] = await p.publish(ctx, token, [{ content: 'olá insta', media: [img()] }], CHANNEL);
    expect(cap.containers).toEqual([
      { access_token: 'IGQlong', image_url: 'https://mp/uploads/a.jpg', caption: 'olá insta' },
    ]);
    expect(cap.publishes).toEqual([{ access_token: 'IGQlong', creation_id: 'cont-1' }]);
    // o container é criado em /{userId}/media — nunca em /me quando o canal sabe o id
    expect(ctx.calls.some((c) => c.url.includes('/v21.0/17841/media'))).toBe(true);
    expect(res).toEqual({ externalId: 'post-1', releaseUrl: 'https://www.instagram.com/p/abc/' });
  });

  test('vídeo único no feed vira REELS', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    await p.publish(ctx, token, [{ content: 'meu reel', media: [vid()] }], CHANNEL);
    expect(cap.containers).toEqual([
      { access_token: 'IGQlong', video_url: 'https://mp/uploads/v.mp4', media_type: 'REELS', caption: 'meu reel' },
    ]);
  });

  test('carrossel: filhos is_carousel_item SEM legenda, pai CAROUSEL com children + caption', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    await p.publish(
      ctx,
      token,
      [{ content: 'álbum', media: [img('https://mp/uploads/a.jpg'), vid('https://mp/uploads/v.mp4')] }],
      CHANNEL,
    );
    expect(cap.containers).toEqual([
      { access_token: 'IGQlong', is_carousel_item: 'true', image_url: 'https://mp/uploads/a.jpg' },
      { access_token: 'IGQlong', is_carousel_item: 'true', video_url: 'https://mp/uploads/v.mp4', media_type: 'VIDEO' },
      { access_token: 'IGQlong', media_type: 'CAROUSEL', children: 'cont-1,cont-2', caption: 'álbum' },
    ]);
    expect(cap.publishes).toEqual([{ access_token: 'IGQlong', creation_id: 'cont-3' }]);
  });

  test('story: media_type STORIES, sem caption', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    await p.publish(ctx, token, [{ content: 'ignorado no story', media: [img()] }], {
      ...CHANNEL,
      postType: 'story',
    });
    expect(cap.containers).toEqual([
      { access_token: 'IGQlong', image_url: 'https://mp/uploads/a.jpg', media_type: 'STORIES' },
    ]);
  });

  test('story com mais de uma mídia → 422 (não existe carrossel de story; não publica parcial)', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    await expect(
      p.publish(ctx, token, [{ content: 'x', media: [img(), img('https://mp/uploads/b.jpg')] }], {
        ...CHANNEL,
        postType: 'story',
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(cap.publishes).toEqual([]); // nada foi ao ar
  });

  test('publishReply: réplica vira COMENTÁRIO no post raiz (só texto)', async () => {
    const cap = capture();
    const ctx = route([
      [
        '/comments',
        (f) => {
          cap.containers.push(f);
          return jsonResponse({ id: 'comment-1' });
        },
      ],
      ['permalink', () => jsonResponse({ permalink: 'https://www.instagram.com/p/raiz/' })],
    ]);
    const res = await p.publishReply!(ctx, token, 'post-raiz', { content: 'complementando', media: [] }, CHANNEL);
    expect(cap.containers[0]).toEqual({ access_token: 'IGQlong', message: 'complementando' });
    expect(ctx.calls[0]!.url).toBe('https://graph.instagram.com/v21.0/post-raiz/comments');
    expect(res).toEqual({ externalId: 'comment-1', releaseUrl: 'https://www.instagram.com/p/raiz/' });
  });

  test('permalink indisponível NÃO derruba um post já publicado (nunca reposta)', async () => {
    const cap = capture();
    const ctx = route([
      ...happyRoutes(cap).slice(0, 3),
      ['permalink', () => jsonResponse({ error: { message: 'sem permissão' } }, 403)],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'x', media: [img()] }], CHANNEL);
    // cai no perfil do @handle em vez de estourar depois do media_publish
    expect(res).toEqual({ externalId: 'post-1', releaseUrl: 'https://www.instagram.com/criadora' });
  });

  test('sem userId no canal, endereça /me (canal antigo/settings incompletos)', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));
    await p.publish(ctx, token, [{ content: 'x', media: [img()] }], {});
    expect(ctx.calls[0]!.url).toBe('https://graph.instagram.com/v21.0/me/media');
  });

  test('container ERROR → 422 (permanente, com a mensagem da Meta)', async () => {
    const cap = capture();
    const ctx = route([
      ...happyRoutes(cap).slice(0, 2),
      [
        'fields=status_code',
        () => jsonResponse({ status_code: 'ERROR', status: 'The media could not be fetched from this URI' }),
      ],
    ]);
    await expect(
      p.publish(
        ctx,
        token,
        [{ content: 'x', media: [img('http://localhost/a.jpg')] }],
        CHANNEL,
      ),
    ).rejects.toMatchObject({ status: 422, body: 'The media could not be fetched from this URI' });
  });
});

describe('instagram-standalone: regras e erros', () => {
  test('validateMedia: exige mídia no post, carrossel misto passa, >10 não, comentário sem mídia', async () => {
    // post principal exige mídia (requiresMedia)
    expect(await p.validateMedia([{ content: 'sem mídia', media: [] }])).toMatchObject({ ok: false });
    // carrossel misto (imagem+vídeo) é permitido no Instagram
    const mixed = [img(), vid()];
    expect(await p.validateMedia([{ content: 'ok', media: mixed }])).toEqual({ ok: true });
    // acima de 10 itens não
    const many = Array.from({ length: 11 }, (_, i) => img(`a${i}.jpg`));
    expect(await p.validateMedia([{ content: 'demais', media: many }])).toMatchObject({ ok: false });
    // réplica (item 1+) com mídia é barrada — comentário é só texto
    expect(
      await p.validateMedia([
        { content: 'principal', media: [img()] },
        { content: 'réplica', media: [img()] },
      ]),
    ).toMatchObject({ ok: false });
    // réplica só texto passa
    expect(
      await p.validateMedia([
        { content: 'principal', media: [img()] },
        { content: 'réplica', media: [] },
      ]),
    ).toEqual({ ok: true });
  });

  test('classifyError: token → refresh; limite/5xx/instabilidade → transient; mídia ruim → permanent', () => {
    expect(p.classifyError(400, '{"error":{"message":"Error validating access token","code":190}}')).toBe(
      'refresh-token',
    );
    expect(p.classifyError(400, '{"error":{"message":"REVOKED_ACCESS_TOKEN","error_subcode":33}}')).toBe(
      'refresh-token',
    );
    expect(p.classifyError(400, '{"error":{"message":"An unknown error occurred","code":1}}')).toBe('transient');
    expect(p.classifyError(400, '{"error":{"message":"Application request limit reached","code":4}}')).toBe(
      'transient',
    );
    // proporção inválida, spam, teto diário → permanente (não adianta retentar em minutos)
    expect(p.classifyError(400, '{"error":{"message":"aspect ratio","code":36003}}')).toBe('permanent');
    expect(p.classifyError(400, '{"error":{"error_subcode":2207042}}')).toBe('permanent');
  });

  test('capacidades: 2200 chars, exige mídia, réplica por comentário', () => {
    expect(p.capabilities.maxLength()).toBe(2200);
    expect(p.capabilities.requiresMedia).toBe(true);
    expect(p.capabilities.threads).toBe(true);
    expect(p.capabilities.media.images.maxCount).toBe(10);
  });
});
