import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { discordProvider as p } from './discord.provider';

runProviderContract(p);

const WEBHOOK = 'https://discord.com/api/webhooks/111/token-abc';
const HOOK = { id: '111', name: 'manypost', channel_id: '222', guild_id: '333' };
const token = { accessToken: WEBHOOK, scopes: [] };
const settings = { guildId: '333', channelId: '222' };

describe('discord: conexão por webhook', () => {
  test('URL válida: GET valida e resolve canal/servidor', async () => {
    const ctx = mockCtx((url) => (url === WEBHOOK ? jsonResponse(HOOK) : jsonResponse({}, 404)));
    const account = await p.connectWithFields!(ctx, { fields: { webhookUrl: WEBHOOK } });
    expect(account).toMatchObject({
      accessToken: WEBHOOK,
      externalId: '222', // o canal é o alvo (reconectar troca só o token)
      name: 'manypost',
      channelSettings: { channelId: '222', guildId: '333' },
    });
    expect(account.scopes).toEqual([]);
    expect((account as { refreshToken?: string }).refreshToken).toBeUndefined();
  });

  test('host alternativo/versão é canonicalizado antes do GET', async () => {
    const ctx = mockCtx(() => jsonResponse(HOOK));
    await p.connectWithFields!(ctx, {
      fields: { webhookUrl: 'https://discordapp.com/api/v10/webhooks/111/token-abc' },
    });
    expect(ctx.calls[0]!.url).toBe(WEBHOOK); // canônico: discord.com/api/webhooks/{id}/{token}
  });

  test('URL que não é webhook do Discord → rejeitada na validação de campos', async () => {
    const ctx = mockCtx(() => jsonResponse({}));
    await expect(
      p.connectWithFields!(ctx, { fields: { webhookUrl: 'https://evil.example/x' } }),
    ).rejects.toThrow();
  });

  test('webhook inexistente (GET 404) → erro {status} p/ virar connect_failed', async () => {
    const ctx = mockCtx(() => jsonResponse({ message: 'Unknown Webhook' }, 404));
    await expect(
      p.connectWithFields!(ctx, { fields: { webhookUrl: WEBHOOK } }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('discord: publicação (golden bodies)', () => {
  test('texto puro → POST ?wait=true com content, sem flags; externalId + releaseUrl', async () => {
    let body: any;
    const ctx = mockCtx((url, init) => {
      expect(url).toBe(`${WEBHOOK}?wait=true`);
      body = JSON.parse(String(init!.body));
      return jsonResponse({ id: '999', channel_id: '222' });
    });
    const [res] = await p.publish(ctx, token, [{ content: 'olá discord', media: [] }], settings);
    expect(body).toEqual({ content: 'olá discord' });
    expect(res).toEqual({ externalId: '999', releaseUrl: 'https://discord.com/channels/333/222/999' });
  });

  test('suppressEmbeds + silent → flags combinadas (4100)', async () => {
    let body: any;
    const ctx = mockCtx((_url, init) => {
      body = JSON.parse(String(init!.body));
      return jsonResponse({ id: '1', channel_id: '222' });
    });
    await p.publish(ctx, token, [{ content: 'x', media: [] }], {
      ...settings,
      suppressEmbeds: true,
      silent: true,
    });
    expect(body.flags).toBe((1 << 2) | (1 << 12)); // 4100
  });

  test('sem guildId nos settings → sem releaseUrl (mas com externalId)', async () => {
    const ctx = mockCtx(() => jsonResponse({ id: '2', channel_id: '222' }));
    const [res] = await p.publish(ctx, token, [{ content: 'x', media: [] }], {});
    expect(res).toEqual({ externalId: '2' });
  });

  test('com mídia → multipart payload_json + files[i]; anexo com filename/description', async () => {
    let payload: any;
    let file: unknown;
    const ctx = mockCtx((url, init) => {
      if (url === 'https://mp/uploads/a.png') return new Response(new Uint8Array([1, 2, 3]));
      const form = init!.body as FormData;
      payload = JSON.parse(String(form.get('payload_json')));
      file = form.get('files[0]');
      return jsonResponse({ id: '1000', channel_id: '222' });
    });
    const [res] = await p.publish(
      ctx,
      token,
      [{ content: 'com foto', media: [{ type: 'image', url: 'https://mp/uploads/a.png', mime: 'image/png', alt: 'gatinho' }] }],
      settings,
    );
    expect(payload).toEqual({
      content: 'com foto',
      attachments: [{ id: 0, filename: 'media-0.png', description: 'gatinho' }],
    });
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe('media-0.png');
    expect(res).toEqual({ externalId: '1000', releaseUrl: 'https://discord.com/channels/333/222/1000' });
  });

  test('mídia inacessível ao worker → 422 (não 500)', async () => {
    const ctx = mockCtx((url) => {
      if (url.startsWith('https://mp/')) return jsonResponse({}, 403);
      return jsonResponse({ id: '3', channel_id: '222' });
    });
    await expect(
      p.publish(ctx, token, [{ content: 'x', media: [{ type: 'image', url: 'https://mp/x.png' }] }], settings),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('discord: regras', () => {
  test('validateMedia: teto combinado de 10 anexos (mesmo misturando)', async () => {
    const media = [
      ...Array.from({ length: 6 }, (_, i) => ({ type: 'image' as const, url: `i${i}`, mime: 'image/png' })),
      ...Array.from({ length: 5 }, (_, i) => ({ type: 'video' as const, url: `v${i}`, mime: 'video/mp4' })),
    ];
    expect(await p.validateMedia([{ content: 'x', media }])).toEqual({
      ok: false,
      reason: 'máximo de 10 anexos por post',
    });
    expect(await p.validateMedia([{ content: 'x', media: media.slice(0, 10) }])).toEqual({ ok: true });
  });

  test('classifyError: 404/Unknown Webhook → refresh-token; 5xx transient; 4xx permanente', () => {
    expect(p.classifyError(404, '{"code":10015,"message":"Unknown Webhook"}')).toBe('refresh-token');
    expect(p.classifyError(401, '')).toBe('refresh-token');
    expect(p.classifyError(429, '')).toBe('transient');
    expect(p.classifyError(503, '')).toBe('transient');
    expect(p.classifyError(400, 'bad request')).toBe('permanent');
  });
});
