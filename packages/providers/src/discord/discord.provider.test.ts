import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { discordProvider as p } from './discord.provider';

runProviderContract(p);

const token = { accessToken: 'oauth-token-123', externalId: 'guild-333', channelSettings: { guildId: 'guild-333', channelId: 'channel-222' }, scopes: ['bot', 'identify', 'guilds'] };
const settings = { guildId: 'guild-333', channelId: 'channel-222' };

describe('discord: OAuth2 + Bot (Paridade Postiz)', () => {
  test('getAuthUrl: gera URL OAuth do Discord com permissions=377957124096 e scopes bot/identify/guilds', async () => {
    const ctx = mockCtx(() => jsonResponse({}), { clientId: 'client-111', clientSecret: 'secret-222', botToken: 'bot-token-999' });
    const { url, state } = await p.getAuthUrl(ctx, { redirectUri: 'https://mp/cb' });
    expect(url).toContain('https://discord.com/oauth2/authorize');
    expect(url).toContain('client_id=client-111');
    expect(url).toContain('permissions=377957124096');
    expect(url).toContain('scope=bot+identify+guilds');
    expect(url).toContain(`state=${state}`);
  });

  test('exchangeCode: troca code por accessToken + guildId e resolve app @me', async () => {
    const ctx = mockCtx((url) => {
      if (url === 'https://discord.com/api/oauth2/token') {
        return jsonResponse({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 604800,
          scope: 'bot identify guilds',
          guild: { id: 'guild-333', name: 'Meu Servidor Discord' },
        });
      }
      if (url === 'https://discord.com/api/oauth2/@me') {
        return jsonResponse({ application: { name: 'Manypost Bot', bot: { id: 'bot-42', avatar: 'av-hash', username: 'mpbot' } } });
      }
      return jsonResponse({}, 404);
    }, { clientId: 'client-111', clientSecret: 'secret-222', botToken: 'bot-token-999' });

    const account = await p.exchangeCode(ctx, { code: 'code-xyz', redirectUri: 'https://mp/cb' });
    expect(account.externalId).toBe('guild-333');
    expect(account.name).toBe('Meu Servidor Discord');
    expect(account.username).toBe('mpbot');
    expect(account.channelSettings).toEqual({ guildId: 'guild-333', chatType: 'guild' });
  });

  test('listSubAccounts: lista canais de texto/anúncio/fórum do servidor (twoStepConnect)', async () => {
    const ctx = mockCtx((url) => {
      expect(url).toBe('https://discord.com/api/v10/guilds/guild-333/channels');
      return jsonResponse([
        { id: 'ch-1', name: 'geral', type: 0 },
        { id: 'ch-2', name: 'voz', type: 2 }, // ignorado
        { id: 'ch-3', name: 'anuncios', type: 5 },
      ]);
    }, { botToken: 'bot-token-999' });

    const channels = await p.listSubAccounts!(ctx, token as any);
    expect(channels).toHaveLength(2);
    expect(channels[0]).toEqual({
      externalId: 'ch-1',
      name: '#geral',
      channelSettings: { guildId: 'guild-333', channelId: 'ch-1' },
    });
    expect(channels[1]!.name).toBe('#anuncios');
  });

  test('publish: texto puro via Bot Token ao canal selecionado', async () => {
    let body: any;
    let authHeader: string | undefined;
    const ctx = mockCtx((url, init) => {
      expect(url).toBe('https://discord.com/api/v10/channels/channel-222/messages');
      authHeader = (init!.headers as Record<string, string>)?.authorization || (init!.headers as Record<string, string>)?.['Authorization'];
      body = JSON.parse(String(init!.body));
      return jsonResponse({ id: 'msg-999', channel_id: 'channel-222' });
    }, { botToken: 'bot-token-999' });

    const [res] = await p.publish(ctx, token as any, [{ content: 'olá canal discord', media: [] }], settings);
    expect(authHeader).toBe('Bot bot-token-999');
    expect(body).toEqual({ content: 'olá canal discord' });
    expect(res).toEqual({ externalId: 'msg-999', releaseUrl: 'https://discord.com/channels/guild-333/channel-222/msg-999' });
  });
});
