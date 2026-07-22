import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { twitchProvider as p } from './twitch.provider';

runProviderContract(p);

const SECRETS = { clientId: 'cid', clientSecret: 'csec' };
const token = { accessToken: 'at', refreshToken: 'rt', scopes: [] };
/** settings do canal (merge): broadcasterId endereça a Helix, login monta a URL */
const CHANNEL = { broadcasterId: '4242', login: 'streamer' };

type Json = Record<string, unknown>;

const route = (routes: Array<[string, (body: Json, init?: RequestInit) => Response]>) =>
  mockCtx((url, init) => {
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Json) : {};
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? hit[1](body, init) : jsonResponse({ error: 'não mockado', url }, 404);
  }, SECRETS);

const USER = {
  data: [{ id: '4242', login: 'streamer', display_name: 'Streamer', profile_image_url: 'https://tw/av.png' }],
};

describe('twitch: OAuth', () => {
  test('getAuthUrl: escopos separados por ESPAÇO (a Twitch não aceita vírgula)', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe('https://id.twitch.tv/oauth2/authorize');
    expect(u.searchParams.get('client_id')).toBe('cid');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('scope')).toBe(
      'user:write:chat user:read:chat moderator:manage:announcements',
    );
    expect(u.searchParams.get('state')).toBe(out.state);
  });

  test('exchangeCode: form golden + /helix/users com Client-Id → canal com broadcasterId', async () => {
    let form: URLSearchParams | undefined;
    let userHeaders: Record<string, string> = {};
    const ctx = route([
      [
        '/oauth2/token',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          return jsonResponse({
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 14_400,
            // a Twitch devolve escopo como ARRAY
            scope: ['user:write:chat', 'user:read:chat', 'moderator:manage:announcements'],
          });
        },
      ],
      [
        '/helix/users',
        (_b, init) => {
          userHeaders = (init?.headers ?? {}) as Record<string, string>;
          return jsonResponse(USER);
        },
      ],
    ]);
    const account = await p.exchangeCode(ctx, { code: 'c0d3', redirectUri: 'https://mp/cb' });
    expect(Object.fromEntries(form!)).toEqual({
      grant_type: 'authorization_code',
      code: 'c0d3',
      redirect_uri: 'https://mp/cb',
      client_id: 'cid',
      client_secret: 'csec',
    });
    // sem o Client-Id do app a Helix responde 401 mesmo com bearer válido
    expect(userHeaders['client-id']).toBe('cid');
    expect(account).toMatchObject({
      accessToken: 'at',
      refreshToken: 'rt',
      externalId: '4242',
      name: 'Streamer',
      username: 'streamer',
      avatarUrl: 'https://tw/av.png',
      channelSettings: { broadcasterId: '4242', login: 'streamer' },
      expiresAt: '2026-01-01T16:00:00.000Z',
    });
    expect(account.scopes).toContain('user:write:chat');
  });

  test('exchangeCode sem user:write:chat → 403 legível', async () => {
    const ctx = route([
      ['/oauth2/token', () => jsonResponse({ access_token: 'at', scope: ['user:read:chat'] })],
      ['/helix/users', () => jsonResponse(USER)],
    ]);
    await expect(p.exchangeCode(ctx, { code: 'c', redirectUri: 'https://mp/cb' })).rejects.toMatchObject({
      status: 403,
    });
  });

  test('refreshToken: form golden com o par do app', async () => {
    let form: URLSearchParams | undefined;
    const ctx = route([
      [
        '/oauth2/token',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          return jsonResponse({ access_token: 'at2', refresh_token: 'rt2', expires_in: 14_400 });
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
    expect(out).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2' });
  });
});

describe('twitch: mensagem no chat', () => {
  test('golden do corpo + releaseUrl com o login do canal', async () => {
    let body: Json | undefined;
    const ctx = route([
      [
        '/chat/messages',
        (b) => {
          body = b;
          return jsonResponse({ data: [{ message_id: 'msg-1', is_sent: true }] });
        },
      ],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'olá chat', media: [] }], CHANNEL);
    expect(body).toEqual({ broadcaster_id: '4242', sender_id: '4242', message: 'olá chat' });
    expect(res).toEqual({ externalId: 'msg-1', releaseUrl: 'https://twitch.tv/streamer' });
  });

  test('is_sent:false NÃO é sucesso — vira erro com o drop_reason (o Postiz engolia isso)', async () => {
    const ctx = route([
      [
        '/chat/messages',
        () =>
          jsonResponse({
            data: [{ is_sent: false, drop_reason: { code: 'msg_duplicate', message: 'duplicate message' } }],
          }),
      ],
    ]);
    await expect(p.publish(ctx, token, [{ content: 'oi', media: [] }], CHANNEL)).rejects.toMatchObject({
      status: 422,
      body: expect.stringContaining('duplicate message'),
    });
  });

  test('texto acima de 500 chars é cortado antes de sair', async () => {
    let body: Json | undefined;
    const ctx = route([
      [
        '/chat/messages',
        (b) => {
          body = b;
          return jsonResponse({ data: [{ message_id: 'm', is_sent: true }] });
        },
      ],
    ]);
    await p.publish(ctx, token, [{ content: 'a'.repeat(600), media: [] }], CHANNEL);
    expect(String(body!.message)).toHaveLength(500);
  });

  test('publishReply encadeia por reply_parent_message_id', async () => {
    let body: Json | undefined;
    const ctx = route([
      [
        '/chat/messages',
        (b) => {
          body = b;
          return jsonResponse({ data: [{ message_id: 'msg-2', is_sent: true }] });
        },
      ],
    ]);
    const res = await p.publishReply!(ctx, token, 'msg-1', { content: 'continuando', media: [] }, CHANNEL);
    expect(body).toMatchObject({ reply_parent_message_id: 'msg-1', message: 'continuando' });
    expect(res.externalId).toBe('msg-2');
  });
});

describe('twitch: anúncio do canal', () => {
  test('vai para /chat/announcements com broadcaster+moderator na query e a cor no corpo', async () => {
    let body: Json | undefined;
    let url = '';
    const ctx = mockCtx((u, init) => {
      url = u;
      body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Json) : {};
      return new Response('', { status: 204 }); // anúncio responde 204 sem corpo
    }, SECRETS);
    const [res] = await p.publish(ctx, token, [{ content: 'chegamos', media: [] }], {
      ...CHANNEL,
      messageType: 'announcement',
      announcementColor: 'purple',
    });
    const q = new URL(url).searchParams;
    expect(q.get('broadcaster_id')).toBe('4242');
    expect(q.get('moderator_id')).toBe('4242');
    expect(body).toEqual({ message: 'chegamos', color: 'purple' });
    // sem id de mensagem na resposta: geramos um id próprio, prefixado
    expect(res!.externalId.startsWith('announcement:')).toBe(true);
    expect(res!.releaseUrl).toBe('https://twitch.tv/streamer');
  });

  test('réplica de thread de anúncio é outro anúncio (anúncio não responde a mensagem)', async () => {
    let path = '';
    const ctx = mockCtx((u) => {
      path = u;
      return new Response('', { status: 204 });
    }, SECRETS);
    await p.publishReply!(ctx, token, 'announcement:abc', { content: 'e mais', media: [] }, {
      ...CHANNEL,
      messageType: 'announcement',
    });
    expect(path).toContain('/chat/announcements');
  });
});

describe('twitch: regras e erros', () => {
  test('validateMedia recusa qualquer anexo (chat não carrega mídia)', async () => {
    expect(await p.validateMedia([{ content: 'ok', media: [] }])).toEqual({ ok: true });
    expect(
      await p.validateMedia([
        { content: 'com foto', media: [{ type: 'image', url: 'a.jpg', mime: 'image/jpeg' }] },
      ]),
    ).toMatchObject({ ok: false });
  });

  test('canal sem broadcasterId falha legível em vez de chamar a API', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    await expect(p.publish(ctx, token, [{ content: 'x', media: [] }], {})).rejects.toMatchObject({
      status: 422,
    });
    expect(ctx.calls).toHaveLength(0);
  });

  test('classifyError: 401 → refresh; 429/5xx → transient; resto permanente', () => {
    expect(p.classifyError(401, '')).toBe('refresh-token');
    expect(p.classifyError(429, '')).toBe('transient');
    expect(p.classifyError(503, '')).toBe('transient');
    expect(p.classifyError(403, 'missing scope')).toBe('permanent');
  });
});
