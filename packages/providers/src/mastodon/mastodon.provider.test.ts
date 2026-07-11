import { describe, expect, test } from 'bun:test';
import type { ProviderContext } from '@manypost/contracts';
import { mastodonProvider as p } from './mastodon.provider';

/** ctx.fetch mockado: valida os requests exatos contra a API do Mastodon. */
function mockCtx(routes: Record<string, (init?: RequestInit) => unknown>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const ctx: ProviderContext = {
    fetch: (async (url: any, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const key = Object.keys(routes).find((k) => String(url).includes(k));
      if (!key) return new Response('not found', { status: 404 });
      const out = routes[key]!(init);
      if (out instanceof Response) return out;
      return new Response(JSON.stringify(out), { status: 200 });
    }) as typeof fetch,
    log: () => {},
    now: () => new Date(),
    secrets: {},
  };
  return { ctx, calls };
}

describe('mastodon provider', () => {
  test('getAuthUrl registra app dinamicamente na instância e devolve extra', async () => {
    const { ctx, calls } = mockCtx({
      '/api/v1/apps': () => ({ client_id: 'cid', client_secret: 'csec' }),
    });
    const out = await p.getAuthUrl(ctx, {
      redirectUri: 'https://mp/cb',
      fields: { instance: 'https://mastodon.social/' }, // barra final normalizada
    });
    expect(calls[0]!.url).toBe('https://mastodon.social/api/v1/apps');
    expect(out.url).toStartWith('https://mastodon.social/oauth/authorize?');
    expect(out.url).toContain('client_id=cid');
    expect((out.extra as any).clientSecret).toBe('csec');
  });

  test('exchangeCode troca o code e resolve a conta (instância no channelSettings)', async () => {
    const { ctx } = mockCtx({
      '/oauth/token': () => ({ access_token: 'tok', scope: 'read write' }),
      '/api/v1/accounts/verify_credentials': () => ({
        id: '42',
        username: 'ana',
        display_name: 'Ana',
        avatar: 'https://m/a.png',
        url: 'https://mastodon.social/@ana',
      }),
    });
    const acc = await p.exchangeCode(ctx, {
      code: 'c',
      redirectUri: 'https://mp/cb',
      extra: { instance: 'https://mastodon.social', clientId: 'cid', clientSecret: 'csec' },
    });
    expect(acc.accessToken).toBe('tok');
    expect(acc.externalId).toBe('mastodon.social:42');
    expect(acc.channelSettings).toEqual({ instance: 'https://mastodon.social' });
  });

  test('publish posta status e encadeia thread via in_reply_to_id', async () => {
    let n = 0;
    const bodies: any[] = [];
    const { ctx } = mockCtx({
      '/api/v1/statuses': (init) => {
        bodies.push(JSON.parse(String(init?.body)));
        n++;
        return { id: `s${n}`, url: `https://m/@ana/s${n}` };
      },
    });
    const res = await p.publish(
      ctx,
      { accessToken: 'tok', scopes: [] },
      [
        { content: 'post principal', media: [] },
        { content: 'resposta da thread', media: [] },
      ],
      { instance: 'https://mastodon.social', visibility: 'unlisted' },
    );
    expect(res).toHaveLength(2);
    expect(bodies[0].visibility).toBe('unlisted');
    expect(bodies[0].in_reply_to_id).toBeUndefined();
    expect(bodies[1].in_reply_to_id).toBe('s1');
  });

  test('publish com mídia: baixa do storage, sobe em /api/v2/media e anexa media_ids', async () => {
    const bodies: any[] = [];
    const uploaded: RequestInit[] = [];
    const { ctx } = mockCtx({
      'https://mp/uploads/': () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
      '/api/v2/media': (init) => {
        uploaded.push(init!);
        return { id: `att-${uploaded.length}` };
      },
      '/api/v1/statuses': (init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return { id: 's1', url: 'https://m/@ana/s1' };
      },
    });
    await p.publish(
      ctx,
      { accessToken: 'tok', scopes: [] },
      [
        {
          content: 'post com fotos',
          media: [
            { type: 'image', url: 'https://mp/uploads/org/a.png', mime: 'image/png', alt: 'foto A' },
            { type: 'image', url: 'https://mp/uploads/org/b.png', mime: 'image/png' },
          ],
        },
      ],
      { instance: 'https://mastodon.social' },
    );
    expect(uploaded).toHaveLength(2);
    expect(uploaded[0]!.body).toBeInstanceOf(FormData);
    expect((uploaded[0]!.body as FormData).get('description')).toBe('foto A');
    expect(bodies[0].media_ids).toEqual(['att-1', 'att-2']);
  });

  test('202 no upload → poll até 200 antes de postar (processamento assíncrono)', async () => {
    let polls = 0;
    const { ctx } = mockCtx({
      'https://mp/uploads/': () => new Response(new Uint8Array([0, 0, 0, 0x10])),
      '/api/v2/media': () => new Response(JSON.stringify({ id: 'att-9' }), { status: 202 }),
      '/api/v1/media/att-9': () => {
        polls++;
        return new Response(polls < 2 ? '' : '{"id":"att-9"}', { status: polls < 2 ? 206 : 200 });
      },
      '/api/v1/statuses': () => ({ id: 's1', url: 'https://m/s1' }),
    });
    const res = await p.publish(
      ctx,
      { accessToken: 'tok', scopes: [] },
      [{ content: 'vídeo', media: [{ type: 'video', url: 'https://mp/uploads/org/v.mp4' }] }],
      { instance: 'https://mastodon.social' },
    );
    expect(polls).toBe(2);
    expect(res[0]!.externalId).toBe('s1');
  }, 10_000);

  test('validateMedia: 4 imagens ok; 5 imagens, mistura e MIME errado são recusados', async () => {
    const img = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        type: 'image' as const,
        url: `https://u/${i}.png`,
        mime: 'image/png',
      }));
    expect((await p.validateMedia([{ content: 'x', media: img(4) }])).ok).toBe(true);
    expect((await p.validateMedia([{ content: 'x', media: img(5) }])).ok).toBe(false);
    expect(
      (
        await p.validateMedia([
          {
            content: 'x',
            media: [...img(1), { type: 'video', url: 'https://u/v.mp4', mime: 'video/mp4' }],
          },
        ])
      ).ok,
    ).toBe(false);
    expect(
      (
        await p.validateMedia([
          { content: 'x', media: [{ type: 'image', url: 'https://u/a.tiff', mime: 'image/tiff' }] },
        ])
      ).ok,
    ).toBe(false);
  });

  test('canal sem instância → erro permanente; classifyError cobre 401/429/422', async () => {
    const { ctx } = mockCtx({});
    await expect(
      p.publish(ctx, { accessToken: 't', scopes: [] }, [{ content: 'x', media: [] }], {}),
    ).rejects.toMatchObject({ status: 422 });
    expect(p.classifyError(401, '')).toBe('refresh-token');
    expect(p.classifyError(429, '')).toBe('transient');
    expect(p.classifyError(422, '')).toBe('permanent');
  });
});
