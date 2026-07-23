import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { instagramProvider as p } from './instagram.provider';

runProviderContract(p);

const SECRETS = { appId: 'fb-app', appSecret: 's3cr3t' };
/** token do canal = token LONGO do usuário do Facebook (o da Página é derivado no publish) */
const token = { accessToken: 'FBuserLong', scopes: [] };
/** settings do post: a Página escolhida no composer — dela saem o token e o id da conta IG */
const SETTINGS = { pageId: 'page-1' };
/** token da Página, devolvido pela derivação — é ele que tem de assinar toda publicação */
const PAGE_TOKEN = 'PAGE-TOKEN';

type Form = Record<string, string>;
type Route = [string, (form: Form, init?: RequestInit) => Response];

/** roteia por trecho da URL, na ordem declarada (a mais específica primeiro) e entrega o form já parseado. */
const route = (routes: Route[]) =>
  mockCtx((url, init) => {
    const form =
      init?.body === undefined
        ? {}
        : (Object.fromEntries(new URLSearchParams(String(init.body))) as Form);
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? hit[1](form, init) : jsonResponse({ error: { message: 'não mockado', url } }, 404);
  }, SECRETS);

/** a derivação `?fields=access_token,instagram_business_account{id,username}` da Página escolhida */
const targetRoute = (
  body: object = {
    access_token: PAGE_TOKEN,
    instagram_business_account: { id: '17841', username: 'criadora' },
  },
): Route => ['instagram_business_account', () => jsonResponse(body)];

interface Capture {
  containers: Form[];
  publishes: Form[];
}
const capture = (): Capture => ({ containers: [], publishes: [] });

/** container criado → FINISHED no 1º poll → publicado → permalink. */
const happyRoutes = (cap: Capture): Route[] => [
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
  ['fields=permalink', () => jsonResponse({ permalink: 'https://www.instagram.com/p/abc/' })],
  targetRoute(),
];

type MediaRefLike = { type: 'image' | 'video'; url: string; mime: string };
const img = (url = 'https://mp/uploads/a.jpg'): MediaRefLike => ({
  type: 'image',
  url,
  mime: 'image/jpeg',
});
const vid = (url = 'https://mp/uploads/v.mp4'): MediaRefLike => ({
  type: 'video',
  url,
  mime: 'video/mp4',
});

describe('instagram (via Facebook Business): OAuth do Facebook Login', () => {
  test('getAuthUrl: diálogo do facebook.com com os escopos do Instagram por vírgula', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);

    expect(u.origin + u.pathname).toBe('https://www.facebook.com/v20.0/dialog/oauth');
    expect(u.searchParams.get('client_id')).toBe('fb-app');
    expect(u.searchParams.get('redirect_uri')).toBe('https://mp/cb');
    expect(u.searchParams.get('response_type')).toBe('code');
    // paridade de escopos com o Postiz (instagram.provider.ts)
    expect(u.searchParams.get('scope')).toBe(
      'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management,instagram_manage_comments,instagram_manage_insights',
    );
    expect(u.searchParams.get('state')).toBe(out.state);
  });

  test('exchangeCode: code → curto → fb_exchange_token (longo ~60d) → canal do usuário', async () => {
    const ctx = route([
      [
        'fb_exchange_token',
        () => jsonResponse({ access_token: 'FBuserLong', expires_in: 5_184_000 }),
      ],
      ['/oauth/access_token', () => jsonResponse({ access_token: 'short' })],
      [
        '/me/permissions',
        () =>
          jsonResponse({
            data: [
              { permission: 'instagram_basic', status: 'granted' },
              { permission: 'instagram_content_publish', status: 'granted' },
            ],
          }),
      ],
      [
        '/me?',
        () =>
          jsonResponse({
            id: 'fb-user-9',
            name: 'Criadora',
            picture: { data: { url: 'https://cdn.fb/av.jpg' } },
          }),
      ],
    ]);

    const account = await p.exchangeCode(ctx, { code: 'c0d3', redirectUri: 'https://mp/cb' });

    const shortQ = new URL(ctx.calls[0]!.url).searchParams;
    expect(shortQ.get('client_id')).toBe('fb-app');
    expect(shortQ.get('client_secret')).toBe('s3cr3t');
    expect(shortQ.get('redirect_uri')).toBe('https://mp/cb');
    expect(shortQ.get('code')).toBe('c0d3');

    const longQ = new URL(ctx.calls[1]!.url).searchParams;
    expect(longQ.get('grant_type')).toBe('fb_exchange_token');
    expect(longQ.get('fb_exchange_token')).toBe('short');

    expect(account).toMatchObject({
      accessToken: 'FBuserLong',
      // no Facebook Login não há refresh token separado: o token longo se reapresenta para renovar
      refreshToken: 'FBuserLong',
      externalId: 'fb-user-9',
      name: 'Criadora',
      avatarUrl: 'https://cdn.fb/av.jpg',
      // o canal representa a CONTA; a conta do Instagram é escolhida por post (via Página)
      channelSettings: { userId: 'fb-user-9' },
    });
    expect(account.expiresAt).toBe(new Date('2026-03-02T12:00:00Z').toISOString());
    expect(account.scopes).toContain('instagram_content_publish');
  });

  test('exchangeCode: sem instagram_content_publish concedido → 403 legível (nada de canal)', async () => {
    const ctx = route([
      ['fb_exchange_token', () => jsonResponse({ access_token: 'FBuserLong' })],
      ['/oauth/access_token', () => jsonResponse({ access_token: 'short' })],
      [
        '/me/permissions',
        () =>
          jsonResponse({
            data: [
              { permission: 'instagram_basic', status: 'granted' },
              { permission: 'instagram_content_publish', status: 'declined' },
            ],
          }),
      ],
    ]);

    await expect(p.exchangeCode(ctx, { code: 'c0d3', redirectUri: 'https://mp/cb' })).rejects.toMatchObject(
      { status: 403 },
    );
  });

  test('refreshToken: reapresenta o token longo ao fb_exchange_token', async () => {
    const ctx = route([
      ['/oauth/access_token', () => jsonResponse({ access_token: 'FBuserLong2', expires_in: 100 })],
    ]);
    const set = await p.refreshToken(ctx, 'FBuserLong');

    const q = new URL(ctx.calls[0]!.url).searchParams;
    expect(q.get('grant_type')).toBe('fb_exchange_token');
    expect(q.get('fb_exchange_token')).toBe('FBuserLong');
    expect(set).toMatchObject({ accessToken: 'FBuserLong2', refreshToken: 'FBuserLong2' });
  });
});

describe('instagram: sub-contas = Páginas COM conta profissional vinculada', () => {
  test('lista só as Páginas com Instagram, rotuladas pelo @ da conta, gravando o pageId', async () => {
    const ctx = route([
      [
        '/me/accounts',
        () =>
          jsonResponse({
            data: [
              {
                id: 'page-1',
                name: 'Loja da Esquina',
                picture: { data: { url: 'https://cdn.fb/p1.jpg' } },
                instagram_business_account: { id: '17841' },
              },
              // Página SEM Instagram vinculado: não publica aqui, some da lista
              { id: 'page-2', name: 'Página Solta' },
            ],
          }),
      ],
      ['/me/businesses', () => jsonResponse({ data: [] })],
      [
        '/17841?',
        () =>
          jsonResponse({
            username: 'lojadaesquina',
            name: 'Loja da Esquina',
            profile_picture_url: 'https://cdn.ig/av.jpg',
          }),
      ],
    ]);

    const subs = await p.listSubAccounts!(ctx, { ...token, externalId: 'fb-user-9' });

    expect(subs).toEqual([
      {
        // o VALOR é o id da Página (é dele que saem token e conta IG no publish)…
        externalId: 'page-1',
        // …e o RÓTULO é a conta do Instagram, que é o que a pessoa reconhece
        name: '@lojadaesquina',
        username: 'lojadaesquina',
        avatarUrl: 'https://cdn.ig/av.jpg',
        channelSettings: { pageId: 'page-1' },
      },
    ]);
    // o token da Página NUNCA sai daqui para o settings (jsonb sem cifra)
    expect(JSON.stringify(subs)).not.toContain(PAGE_TOKEN);
  });

  test('Business Manager indisponível não derruba a listagem (best-effort)', async () => {
    const ctx = route([
      [
        '/me/accounts',
        () =>
          jsonResponse({
            data: [{ id: 'page-1', name: 'Loja', instagram_business_account: { id: '17841' } }],
          }),
      ],
      ['/me/businesses', () => jsonResponse({ error: { message: 'sem business_management' } }, 403)],
      ['/17841?', () => jsonResponse({ username: 'loja' })],
    ]);

    const subs = await p.listSubAccounts!(ctx, { ...token, externalId: 'fb-user-9' });
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ externalId: 'page-1', name: '@loja' });
  });
});

describe('instagram: publicação (container → poll → media_publish, com o token da Página)', () => {
  test('foto no feed: container com image_url + caption, publicado com o token da PÁGINA', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));

    const out = await p.publish(ctx, token, [{ content: 'olá feed', media: [img()] }], SETTINGS);

    expect(cap.containers).toEqual([
      {
        image_url: 'https://mp/uploads/a.jpg',
        caption: 'olá feed',
        // o token do USUÁRIO nunca publica — quem assina é o token derivado da Página
        access_token: PAGE_TOKEN,
      },
    ]);
    expect(cap.publishes).toEqual([{ creation_id: 'cont-1', access_token: PAGE_TOKEN }]);
    expect(out).toEqual([
      { externalId: 'post-1', releaseUrl: 'https://www.instagram.com/p/abc/' },
    ]);

    // o container vai para /{igUserId}/media — o id da conta IG saiu da Página, não do canal
    expect(ctx.calls.some((c) => c.url.includes('/17841/media'))).toBe(true);
  });

  test('vídeo único no feed vira REELS', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));

    await p.publish(ctx, token, [{ content: 'reel', media: [vid()] }], SETTINGS);

    expect(cap.containers[0]).toMatchObject({
      video_url: 'https://mp/uploads/v.mp4',
      media_type: 'REELS',
      caption: 'reel',
    });
  });

  test('carrossel: filhos is_carousel_item SEM legenda, pai CAROUSEL com children + caption', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));

    const out = await p.publish(
      ctx,
      token,
      [{ content: 'carrossel', media: [img('https://mp/uploads/1.jpg'), vid()] }],
      SETTINGS,
    );

    expect(cap.containers).toEqual([
      {
        is_carousel_item: 'true',
        image_url: 'https://mp/uploads/1.jpg',
        access_token: PAGE_TOKEN,
      },
      {
        is_carousel_item: 'true',
        video_url: 'https://mp/uploads/v.mp4',
        // dentro do carrossel o vídeo é VIDEO (REELS é só o vídeo único do feed)
        media_type: 'VIDEO',
        access_token: PAGE_TOKEN,
      },
      {
        media_type: 'CAROUSEL',
        children: 'cont-1,cont-2',
        caption: 'carrossel',
        access_token: PAGE_TOKEN,
      },
    ]);
    // só o PAI é publicado
    expect(cap.publishes).toEqual([{ creation_id: 'cont-3', access_token: PAGE_TOKEN }]);
    expect(out[0]!.externalId).toBe('post-1');
  });

  test('story: media_type STORIES e sem legenda', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));

    await p.publish(ctx, token, [{ content: 'ignorada', media: [img()] }], {
      ...SETTINGS,
      postType: 'story',
    });

    expect(cap.containers[0]).toEqual({
      image_url: 'https://mp/uploads/a.jpg',
      media_type: 'STORIES',
      access_token: PAGE_TOKEN,
    });
  });

  test('story com mais de uma mídia: 422 ANTES de qualquer chamada (retry duplicaria)', async () => {
    const cap = capture();
    const ctx = route(happyRoutes(cap));

    await expect(
      p.publish(ctx, token, [{ content: 'x', media: [img(), img('https://mp/uploads/b.jpg')] }], {
        ...SETTINGS,
        postType: 'story',
      }),
    ).rejects.toMatchObject({ status: 422 });

    expect(ctx.calls).toHaveLength(0);
    expect(cap.containers).toEqual([]);
  });

  test('sem Página escolhida: 422 legível sem tocar na rede', async () => {
    const ctx = route(happyRoutes(capture()));
    await expect(p.publish(ctx, token, [{ content: 'x', media: [img()] }], {})).rejects.toMatchObject({
      status: 422,
    });
    expect(ctx.calls).toHaveLength(0);
  });

  test('Página sem conta do Instagram vinculada: 422 e nada publicado', async () => {
    const cap = capture();
    const ctx = route([
      ...happyRoutes(cap).filter(([part]) => part !== 'instagram_business_account'),
      targetRoute({ access_token: PAGE_TOKEN }),
    ]);

    await expect(
      p.publish(ctx, token, [{ content: 'x', media: [img()] }], SETTINGS),
    ).rejects.toMatchObject({ status: 422 });
    expect(cap.containers).toEqual([]);
  });

  test('container ERROR: 422 permanente (a Meta recusou a mídia)', async () => {
    const cap = capture();
    const ctx = route([
      ['fields=status_code', () => jsonResponse({ status_code: 'ERROR', status: 'mídia inválida' })],
      ...happyRoutes(cap),
    ]);

    await expect(
      p.publish(ctx, token, [{ content: 'x', media: [img()] }], SETTINGS),
    ).rejects.toMatchObject({ status: 422 });
    // falhou ANTES do media_publish — nada foi para a rede, retry é seguro
    expect(cap.publishes).toEqual([]);
  });

  test('permalink que falha NÃO derruba a publicação (o post já está na rede)', async () => {
    const cap = capture();
    const ctx = route([
      ['fields=permalink', () => jsonResponse({ error: { message: 'sem permissão' } }, 403)],
      ...happyRoutes(cap),
    ]);

    const out = await p.publish(ctx, token, [{ content: 'x', media: [img()] }], SETTINGS);

    // cai no perfil da conta IG resolvida pela Página, e o externalId é preservado
    expect(out).toEqual([
      { externalId: 'post-1', releaseUrl: 'https://www.instagram.com/criadora' },
    ]);
  });
});

describe('instagram: réplicas viram comentários', () => {
  test('publishReply comenta no post raiz com o token da Página e devolve o permalink do pai', async () => {
    const forms: Form[] = [];
    const ctx = route([
      [
        '/comments',
        (f) => {
          forms.push(f);
          return jsonResponse({ id: 'comment-1' });
        },
      ],
      ['fields=permalink', () => jsonResponse({ permalink: 'https://www.instagram.com/p/abc/' })],
      targetRoute(),
    ]);

    const out = await p.publishReply!(
      ctx,
      token,
      'post-1',
      { content: 'primeiro comentário', media: [] },
      SETTINGS,
    );

    expect(forms).toEqual([{ message: 'primeiro comentário', access_token: PAGE_TOKEN }]);
    expect(out).toEqual({
      externalId: 'comment-1',
      releaseUrl: 'https://www.instagram.com/p/abc/',
    });
  });
});

describe('instagram: validação de mídia e classificação de erro', () => {
  test('feed exige mídia, limita o carrossel a 10 e aceita mistura imagem+vídeo', async () => {
    expect(await p.validateMedia([{ content: 'x', media: [] }])).toMatchObject({ ok: false });
    expect(await p.validateMedia([{ content: 'x', media: [img(), vid()] }])).toEqual({ ok: true });

    const onze = Array.from({ length: 11 }, (_, i) => img(`https://mp/uploads/${i}.jpg`));
    expect(await p.validateMedia([{ content: 'x', media: onze }])).toMatchObject({ ok: false });
  });

  test('comentário é só texto — mídia em réplica é barrada no agendamento', async () => {
    const verdict = await p.validateMedia([
      { content: 'post', media: [img()] },
      { content: 'réplica', media: [img()] },
    ]);
    expect(verdict).toMatchObject({ ok: false });
  });

  test('classifyError separa token, instabilidade e recusa definitiva', () => {
    // token/permissão: refresh e, se não der, reconectar
    expect(p.classifyError(400, '{"error":{"code":190}}')).toBe('refresh-token');
    expect(p.classifyError(400, 'REVOKED_ACCESS_TOKEN')).toBe('refresh-token');
    expect(p.classifyError(400, 'The user is not an Instagram Business')).toBe('refresh-token');
    expect(p.classifyError(400, 'Page publishing authorization required')).toBe('refresh-token');

    // instabilidade da Meta e soluços de download de mídia: retentar
    expect(p.classifyError(400, 'An unknown error occurred')).toBe('transient');
    expect(p.classifyError(400, '{"error":{"error_subcode":2207003}}')).toBe('transient');

    // recusa definitiva: teto diário, spam, proporção — retentar não ajuda
    expect(p.classifyError(400, '{"error":{"error_subcode":2207042}}')).toBe('permanent');
    expect(p.classifyError(400, '{"error":{"error_subcode":2207001}}')).toBe('permanent');
  });
});
