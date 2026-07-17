import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { telegramProvider as p } from './telegram.provider';

runProviderContract(p);

const CHAT = { id: -1001234, type: 'channel', title: 'Meu Canal', username: 'meucanal' };

const okApi = (result: unknown) => jsonResponse({ ok: true, result });
const errApi = (error_code: number, description: string, retry_after?: number) =>
  jsonResponse({
    ok: false,
    error_code,
    description,
    ...(retry_after ? { parameters: { retry_after } } : {}),
  });

const route = (routes: Record<string, (body: any) => Response>) =>
  mockCtx(
    (url, init) => {
      const method = url.split('/').pop()!;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const handler = routes[method];
      return handler ? handler(body) : errApi(404, `método não mockado: ${method}`);
    },
    { botToken: 'BOT:TOKEN' },
  );

const token = { accessToken: 'BOT:TOKEN', scopes: [] };
const settings = { chatId: -1001234, chatUsername: 'meucanal' };

describe('telegram: conexão por campos', () => {
  test('@canal validado: getChat + bot admin com can_post → canal conectado', async () => {
    const ctx = route({
      getChat: (b) => {
        expect(b.chat_id).toBe('@meucanal');
        return okApi(CHAT);
      },
      getMe: () => okApi({ id: 42, username: 'mp_bot' }),
      getChatMember: (b) => {
        expect(b).toEqual({ chat_id: -1001234, user_id: 42 });
        return okApi({ status: 'administrator', can_post_messages: true });
      },
    });
    const account = await p.connectWithFields!(ctx, { fields: { chat: 'https://t.me/meucanal' } });
    expect(account).toMatchObject({
      accessToken: 'BOT:TOKEN',
      externalId: '-1001234',
      name: 'Meu Canal',
      username: 'meucanal',
      channelSettings: { chatId: -1001234, chatUsername: 'meucanal', chatType: 'channel' },
    });
  });

  test('bot sem permissão de publicar no canal → erro claro', async () => {
    const ctx = route({
      getChat: () => okApi(CHAT),
      getMe: () => okApi({ id: 42, username: 'mp_bot' }),
      getChatMember: () => okApi({ status: 'member' }),
    });
    await expect(p.connectWithFields!(ctx, { fields: { chat: '@meucanal' } })).rejects.toMatchObject({
      status: 422,
    });
  });

  test('conversa privada é recusada; id numérico vira number', async () => {
    const ctx = route({
      getChat: (b) => {
        expect(b.chat_id).toBe(777); // número, não string
        return okApi({ id: 777, type: 'private' });
      },
    });
    await expect(p.connectWithFields!(ctx, { fields: { chat: '777' } })).rejects.toMatchObject({
      status: 422,
    });
  });

  test('auto-descoberta por comando /connect ABCD no canal (paridade Postiz)', async () => {
    const ctx = route({
      getUpdates: (b) => {
        expect(b.allowed_updates).toEqual(['message', 'channel_post']);
        return okApi([
          {
            update_id: 1,
            channel_post: {
              message_id: 99,
              text: '/connect W9X2',
              chat: CHAT,
            },
          },
        ]);
      },
      deleteMessage: (b) => {
        expect(b).toEqual({ chat_id: -1001234, message_id: 99 });
        return okApi(true);
      },
      getChat: (b) => {
        expect(b.chat_id).toBe(-1001234);
        return okApi(CHAT);
      },
      getMe: () => okApi({ id: 42, username: 'mp_bot' }),
      getChatMember: () => okApi({ status: 'administrator', can_post_messages: true }),
    });
    const account = await p.connectWithFields!(ctx, { fields: { chat: 'W9X2' } });
    expect(account.externalId).toBe('-1001234');
    expect(account.name).toBe('Meu Canal');
  });
});

describe('telegram: publicação (golden bodies)', () => {
  test('texto puro → sendMessage com link preview configurável', async () => {
    const ctx = route({
      sendMessage: (b) => {
        expect(b).toEqual({
          chat_id: -1001234,
          disable_notification: false,
          text: 'olá manypost',
          link_preview_options: { is_disabled: false },
        });
        return okApi({ message_id: 9, chat: CHAT });
      },
    });
    const [res] = await p.publish(ctx, token, [{ content: 'olá manypost', media: [] }], settings);
    expect(res).toEqual({ externalId: '9', releaseUrl: 'https://t.me/meucanal/9' });
  });

  test('1 imagem → sendPhoto com caption; chat sem username não tem releaseUrl', async () => {
    const ctx = route({
      sendPhoto: (b) => {
        expect(b.photo).toBe('https://mp/uploads/a.png');
        expect(b.caption).toBe('legenda');
        return okApi({ message_id: 10, chat: { id: -5, type: 'group', title: 'Grupo' } });
      },
    });
    const [res] = await p.publish(
      ctx,
      token,
      [{ content: 'legenda', media: [{ type: 'image', url: 'https://mp/uploads/a.png' }] }],
      { chatId: -5 },
    );
    expect(res).toEqual({ externalId: '10' });
  });

  test('várias mídias → sendMediaGroup com caption só no primeiro item', async () => {
    const ctx = route({
      sendMediaGroup: (b) => {
        expect(b.media).toEqual([
          { type: 'photo', media: 'https://mp/1.png', caption: 'álbum' },
          { type: 'video', media: 'https://mp/2.mp4' },
        ]);
        return okApi([
          { message_id: 11, chat: CHAT },
          { message_id: 12, chat: CHAT },
        ]);
      },
    });
    const [res] = await p.publish(
      ctx,
      token,
      [
        {
          content: 'álbum',
          media: [
            { type: 'image', url: 'https://mp/1.png' },
            { type: 'video', url: 'https://mp/2.mp4' },
          ],
        },
      ],
      settings,
    );
    expect(res!.externalId).toBe('11');
  });

  test('réplica de thread → reply_parameters apontando o pai', async () => {
    const ctx = route({
      sendMessage: (b) => {
        expect(b.reply_parameters).toEqual({ message_id: 9 });
        return okApi({ message_id: 13, chat: CHAT });
      },
    });
    const res = await p.publishReply!(ctx, token, '9', { content: 'resposta', media: [] }, settings);
    expect(res.externalId).toBe('13');
  });

  test('erro da Bot API vira {status, body} com retry_after visível', async () => {
    const ctx = route({
      sendMessage: () => errApi(429, 'Too Many Requests', 31),
    });
    await expect(
      p.publish(ctx, token, [{ content: 'x', media: [] }], settings),
    ).rejects.toMatchObject({ status: 429, body: 'Too Many Requests (retry_after=31s)' });
    expect(p.classifyError(429, '')).toBe('transient');
    expect(p.classifyError(403, 'bot was kicked')).toBe('refresh-token');
  });

  test('canal sem chatId nos settings → 422 pedindo reconexão', async () => {
    const ctx = route({});
    await expect(p.publish(ctx, token, [{ content: 'x', media: [] }], {})).rejects.toMatchObject({
      status: 422,
    });
  });
});
