import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { kickProvider as p } from './kick.provider';

runProviderContract(p);

const SECRETS = { clientId: 'cid', clientSecret: 'csec' };
const token = { accessToken: 'at', refreshToken: 'rt', scopes: [] };
const CHANNEL = { broadcasterUserId: '77', username: 'streamer' };

type Json = Record<string, unknown>;

const route = (routes: Array<[string, (body: Json, init?: RequestInit) => Response]>) =>
  mockCtx((url, init) => {
    const body =
      typeof init?.body === 'string' && init.body.startsWith('{') ? (JSON.parse(init.body) as Json) : {};
    const hit = routes.find(([part]) => url.includes(part));
    return hit ? hit[1](body, init) : jsonResponse({ error: 'não mockado', url }, 404);
  }, SECRETS);

const b64urlToBytes = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const USER = { data: [{ user_id: 77, name: 'streamer', profile_picture: 'https://kick/av.png' }] };

describe('kick: OAuth 2.1 (PKCE obrigatório)', () => {
  test('getAuthUrl: challenge S256 confere com o verifier devolvido', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const out = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    const u = new URL(out.url);
    expect(u.origin + u.pathname).toBe('https://id.kick.com/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('cid');
    expect(u.searchParams.get('scope')).toBe('chat:write user:read channel:read');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(out.codeVerifier!)),
    );
    expect(b64urlToBytes(u.searchParams.get('code_challenge')!)).toEqual(digest);
  });

  test('exchangeCode: form golden com code_verifier → canal com broadcasterUserId', async () => {
    let form: URLSearchParams | undefined;
    const ctx = route([
      [
        '/oauth/token',
        (_b, init) => {
          form = new URLSearchParams(String(init?.body));
          return jsonResponse({
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 7200,
            scope: 'chat:write user:read channel:read',
          });
        },
      ],
      ['/public/v1/users', () => jsonResponse(USER)],
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
      client_id: 'cid',
      client_secret: 'csec',
    });
    expect(account).toMatchObject({
      accessToken: 'at',
      refreshToken: 'rt',
      externalId: '77',
      username: 'streamer',
      avatarUrl: 'https://kick/av.png',
      channelSettings: { broadcasterUserId: '77', username: 'streamer' },
      expiresAt: '2026-01-01T14:00:00.000Z',
    });
  });

  test('exchangeCode sem chat:write → 403 legível', async () => {
    const ctx = route([
      ['/oauth/token', () => jsonResponse({ access_token: 'at', scope: 'user:read' })],
      ['/public/v1/users', () => jsonResponse(USER)],
    ]);
    await expect(p.exchangeCode(ctx, { code: 'c', redirectUri: 'https://mp/cb' })).rejects.toMatchObject({
      status: 403,
    });
  });

  test('/users tolera resposta como objeto único (a API já devolveu os dois formatos)', async () => {
    const ctx = route([
      ['/oauth/token', () => jsonResponse({ access_token: 'at', scope: 'chat:write' })],
      ['/public/v1/users', () => jsonResponse({ data: { user_id: 9, name: 'solo' } })],
    ]);
    const account = await p.exchangeCode(ctx, { code: 'c', redirectUri: 'https://mp/cb' });
    expect(account.externalId).toBe('9');
  });
});

describe('kick: mensagem no chat', () => {
  test('golden do corpo (type user + broadcaster_user_id numérico) e releaseUrl do canal', async () => {
    let body: Json | undefined;
    const ctx = route([
      [
        '/public/v1/chat',
        (b) => {
          body = b;
          return jsonResponse({ data: { is_sent: true, message_id: 'k-1' } });
        },
      ],
    ]);
    const [res] = await p.publish(ctx, token, [{ content: 'salve', media: [] }], CHANNEL);
    // broadcaster_user_id vai como NÚMERO — a Kick recusa string aqui
    expect(body).toEqual({ type: 'user', content: 'salve', broadcaster_user_id: 77 });
    expect(res).toEqual({ externalId: 'k-1', releaseUrl: 'https://kick.com/streamer' });
  });

  test('is_sent:false vira erro (o Postiz marcava status error e seguia)', async () => {
    const ctx = route([['/public/v1/chat', () => jsonResponse({ data: { is_sent: false } })]]);
    await expect(p.publish(ctx, token, [{ content: 'oi', media: [] }], CHANNEL)).rejects.toMatchObject({
      status: 422,
    });
  });

  test('publishReply encadeia por reply_to_message_id e corta em 500 chars', async () => {
    let body: Json | undefined;
    const ctx = route([
      [
        '/public/v1/chat',
        (b) => {
          body = b;
          return jsonResponse({ data: { is_sent: true, message_id: 'k-2' } });
        },
      ],
    ]);
    await p.publishReply!(ctx, token, 'k-1', { content: 'b'.repeat(700), media: [] }, CHANNEL);
    expect(body).toMatchObject({ reply_to_message_id: 'k-1', broadcaster_user_id: 77 });
    expect(String(body!.content)).toHaveLength(500);
  });
});

describe('kick: regras e erros', () => {
  test('validateMedia recusa qualquer anexo (chat não carrega mídia)', async () => {
    expect(await p.validateMedia([{ content: 'ok', media: [] }])).toEqual({ ok: true });
    expect(
      await p.validateMedia([
        { content: 'com video', media: [{ type: 'video', url: 'v.mp4', mime: 'video/mp4' }] },
      ]),
    ).toMatchObject({ ok: false });
  });

  test('canal sem broadcasterUserId falha legível em vez de chamar a API', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    await expect(p.publish(ctx, token, [{ content: 'x', media: [] }], {})).rejects.toMatchObject({
      status: 422,
    });
    expect(ctx.calls).toHaveLength(0);
  });

  test('classifyError: 401 → refresh; 429/5xx → transient; resto permanente', () => {
    expect(p.classifyError(401, '')).toBe('refresh-token');
    expect(p.classifyError(429, '')).toBe('transient');
    expect(p.classifyError(500, '')).toBe('transient');
    expect(p.classifyError(400, 'bad request')).toBe('permanent');
  });
});
