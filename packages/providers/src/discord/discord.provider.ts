import { z } from 'zod';
import type {
  ChannelProvider,
  MediaRef,
  ProviderContext,
  PublishItem,
  PublishResult,
  TokenSet,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

// Derived from Postiz (AGPL-3.0): direção do discord.provider.ts (OAuth2 + Bot oficial,
// scopes scope=bot+identify+guilds, publishing via API v10 /channels/{id}/messages com Bot Token,
// listSubAccounts p/ o usuário selecionar os canais do servidor). Paridade "Tudo Pronto" (SaaS).

const MAX_LEN = 2000;
const SUPPRESS_EMBEDS = 1 << 2;
const SUPPRESS_NOTIFICATIONS = 1 << 12;
const MAX_ATTACHMENTS = 10;

const API_BASE = 'https://discord.com/api/v10';
const OAUTH_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const OAUTH_ME_URL = 'https://discord.com/api/oauth2/@me';

// 0 = Texto, 5 = Anúncios, 15 = Fórum — os tipos onde o bot pode publicar uma mensagem.
const POSTABLE_CHANNEL_TYPES = new Set([0, 5, 15]);

const settingsSchema = z.object({
  // opcional de propósito: sem canal escolhido o publish usa o canal padrão do servidor
  // (gravado na conexão) ou auto-descobre o 1º canal de texto onde o bot pode postar.
  // Se fosse obrigatório, o agendamento sem canal escolhido falharia na validação de settings.
  channelId: z
    .string()
    .optional()
    .describe('ID do canal de texto (#geral ou ID numérico) para onde o post será enviado — vazio usa o canal padrão do servidor'),
  suppressEmbeds: z
    .boolean()
    .default(false)
    .describe('Não expandir previews de link no post (SUPPRESS_EMBEDS)'),
  silent: z
    .boolean()
    .default(false)
    .describe('Entrega silenciosa, sem push para os membros (SUPPRESS_NOTIFICATIONS)'),
});

interface DiscordMessage {
  id: string;
  channel_id: string;
}

const extOf = (mime?: string): string =>
  (({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }) as Record<string, string>)[mime ?? ''] ?? 'bin';

const fileNameOf = (m: MediaRef, i: number) => `media-${i}.${extOf(m.mime)}`;

const releaseUrlOf = (guildId: string | undefined, channelId: string, messageId: string) =>
  guildId ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}` : undefined;

function parseSettings(rawSettings: unknown) {
  const obj = (rawSettings ?? {}) as {
    guildId?: string;
    channelId?: string;
    suppressEmbeds?: boolean;
    silent?: boolean;
  };
  const parsed = settingsSchema.safeParse(obj);
  const suppressEmbeds = parsed.success ? parsed.data.suppressEmbeds : Boolean(obj.suppressEmbeds);
  const silent = parsed.success ? parsed.data.silent : Boolean(obj.silent);
  const channelId = parsed.success ? parsed.data.channelId : obj.channelId;
  const flags = (suppressEmbeds ? SUPPRESS_EMBEDS : 0) | (silent ? SUPPRESS_NOTIFICATIONS : 0);
  return { guildId: obj.guildId, channelId, flags };
}

async function executeBotPost(
  ctx: ProviderContext,
  botToken: string,
  channelId: string,
  guildId: string | undefined,
  item: PublishItem,
  flags: number,
): Promise<PublishResult> {
  const url = `${API_BASE}/channels/${channelId}/messages`;
  const flagField = flags ? { flags } : {};

  let res: Response;
  if (item.media.length === 0) {
    res = await ctx.fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bot ${botToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: item.content, ...flagField }),
    });
  } else {
    const form = new FormData();
    const attachments: Array<{ id: number; filename: string; description?: string }> = [];
    for (let i = 0; i < item.media.length; i++) {
      const m = item.media[i]!;
      const src = await ctx.fetch(m.url, { signal: AbortSignal.timeout(60_000) });
      if (!src.ok) throw { status: 422, body: `mídia inacessível para o worker: HTTP ${src.status}` };
      const filename = fileNameOf(m, i);
      form.append(`files[${i}]`, await src.blob(), filename);
      attachments.push({ id: i, filename, ...(m.alt ? { description: m.alt } : {}) });
    }
    form.append('payload_json', JSON.stringify({ content: item.content, attachments, ...flagField }));
    res = await ctx.fetch(url, {
      method: 'POST',
      headers: { authorization: `Bot ${botToken}` },
      body: form,
    });
  }

  if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  const msg = (await res.json()) as DiscordMessage;
  const releaseUrl = releaseUrlOf(guildId, msg.channel_id, msg.id);
  return { externalId: msg.id, ...(releaseUrl ? { releaseUrl } : {}) };
}

/** Lista os canais onde o bot pode publicar (texto/anúncio/fórum) via Bot Token. */
async function fetchPostableChannels(
  ctx: ProviderContext,
  botToken: string,
  guildId: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await ctx.fetch(`${API_BASE}/guilds/${guildId}/channels`, {
    headers: { authorization: `Bot ${botToken}` },
  });
  if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  const list = (await res.json()) as Array<{ id: string; name: string; type: number }>;
  return list.filter((c) => POSTABLE_CHANNEL_TYPES.has(c.type)).map((c) => ({ id: c.id, name: c.name }));
}

/** true quando o erro do Discord é de permissão/canal restrito (não adianta tentar de novo). */
const isChannelPermissionError = (err: unknown): boolean => {
  const e = err as { status?: number; body?: string } | undefined;
  const body = String(e?.body ?? '');
  return e?.status === 403 || /Missing Access|Missing Permissions|50001|50013|Unknown Channel/i.test(body);
};

export const discordProvider: ChannelProvider = {
  id: 'discord',
  name: 'Discord',
  capabilities: {
    editor: 'markdown',
    maxLength: () => MAX_LEN,
    media: {
      images: { maxCount: MAX_ATTACHMENTS, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] },
      videos: { maxCount: MAX_ATTACHMENTS, mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'] },
    },
    threads: false,
    mentions: false,
    analytics: false,
    twoStepConnect: true, // Seleciona o canal específico dentro do servidor (guild)
    customInstance: false,
  },
  rateDefaults: {
    maxConcurrent: 5,
    perChannelWindow: { limit: 25, windowSec: 60 },
  },
  settingsSchema,
  requiredSecrets: ['clientId', 'clientSecret', 'botToken'],

  async getAuthUrl(ctx, { redirectUri }) {
    const state = crypto.randomUUID();
    const q = new URLSearchParams({
      client_id: ctx.secrets.clientId ?? '',
      permissions: '377957124096',
      response_type: 'code',
      redirect_uri: redirectUri,
      integration_type: '0',
      scope: 'bot identify guilds',
      state,
    });
    return { url: `https://discord.com/oauth2/authorize?${q}`, state };
  },

  async exchangeCode(ctx, { code, redirectUri }) {
    const res = await ctx.fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${btoa(`${ctx.secrets.clientId ?? ''}:${ctx.secrets.clientSecret ?? ''}`)}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
    const tokenData = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
      guild?: { id: string; name?: string };
    };

    const meRes = await ctx.fetch(OAUTH_ME_URL, {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    const appInfo = (meRes.ok ? await meRes.json() : { application: { name: 'Discord Bot' } }) as {
      application?: { name?: string; bot?: { id?: string; avatar?: string; username?: string } };
    };

    const guildId = tokenData.guild?.id || '';
    const name = tokenData.guild?.name || appInfo?.application?.name || 'Servidor Discord';
    const bot = appInfo?.application?.bot;
    const avatarUrl = bot?.avatar
      ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png`
      : undefined;
    const username = bot?.username;

    // Melhor esforço: pré-seleciona o 1º canal onde o bot pode postar (o usuário troca depois).
    let defaultChannelId: string | undefined;
    if (guildId && ctx.secrets.botToken) {
      const channels = await fetchPostableChannels(ctx, ctx.secrets.botToken, guildId).catch(() => []);
      defaultChannelId = channels[0]?.id;
    }

    return {
      accessToken: tokenData.access_token,
      ...(tokenData.refresh_token ? { refreshToken: tokenData.refresh_token } : {}),
      expiresAt: new Date(ctx.now().getTime() + (tokenData.expires_in ?? 604800) * 1000).toISOString(),
      scopes: tokenData.scope?.split(/[ ,]/).filter(Boolean) ?? ['bot', 'identify', 'guilds'],
      externalId: guildId || 'discord-oauth',
      name,
      ...(username ? { username } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      channelSettings: { guildId, chatType: 'guild', ...(defaultChannelId ? { channelId: defaultChannelId } : {}) },
    };
  },

  async refreshToken(ctx, refreshToken) {
    const res = await ctx.fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${btoa(`${ctx.secrets.clientId ?? ''}:${ctx.secrets.clientSecret ?? ''}`)}`,
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
    const tokenData = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };
    return {
      accessToken: tokenData.access_token,
      ...(tokenData.refresh_token ? { refreshToken: tokenData.refresh_token } : {}),
      expiresAt: new Date(ctx.now().getTime() + (tokenData.expires_in ?? 604800) * 1000).toISOString(),
      scopes: tokenData.scope?.split(/[ ,]/).filter(Boolean) ?? ['bot', 'identify', 'guilds'],
    };
  },

  async listSubAccounts(ctx, token) {
    const guildId = String((token.channelSettings?.guildId as string | undefined) ?? token.externalId ?? '');
    if (!guildId || guildId === 'discord-oauth') return [];
    const botToken = ctx.secrets.botToken;
    if (!botToken) throw { status: 422, body: 'DISCORD_BOT_TOKEN ausente no servidor para listar canais' };

    const channels = await fetchPostableChannels(ctx, botToken, guildId);
    return channels.map((c) => ({
      externalId: c.id,
      name: `#${c.name}`,
      channelSettings: { guildId, channelId: c.id },
    }));
  },

  // Publica com o Bot Token (env). guildId/channelId vêm do `settings` mergeado
  // (channel.settings gravado na conexão + settings da publicação) — nunca do token,
  // que no worker é só { accessToken, scopes } (ver publishing.ts).
  async publish(ctx, _token: TokenSet, items, rawSettings) {
    const cfg = parseSettings(rawSettings);
    const botToken = ctx.secrets.botToken;
    if (!botToken) throw { status: 422, body: 'DISCORD_BOT_TOKEN ausente no servidor para publicar' };

    // Canal escolhido nas configurações vence. Sem ele, auto-descobre os canais postáveis
    // do servidor e tenta cada um até um aceitar (permissões variam por canal) — "Tudo Pronto".
    let channelId = cfg.channelId;
    let candidates: string[] = [];
    if (!channelId && cfg.guildId) {
      candidates = (await fetchPostableChannels(ctx, botToken, cfg.guildId).catch(() => [])).map((c) => c.id);
      channelId = candidates[0];
    }
    if (!channelId) {
      throw {
        status: 422,
        body: 'Canal do Discord não encontrado ou selecionado. Escolha o canal nas Configurações do post ou verifique se o bot tem acesso a algum canal de texto do servidor.',
      };
    }

    const tryChannels = !cfg.channelId && candidates.length > 1 ? candidates : [channelId];
    const results: PublishResult[] = [];
    for (const item of items) {
      let lastErr: unknown;
      let posted = false;
      for (const cid of tryChannels) {
        try {
          results.push(await executeBotPost(ctx, botToken, cid, cfg.guildId, item, cfg.flags));
          posted = true;
          break;
        } catch (err) {
          lastErr = err;
          if (isChannelPermissionError(err) && tryChannels.length > 1) continue; // canal restrito → próximo
          throw err;
        }
      }
      if (!posted) {
        throw (
          lastErr ?? {
            status: 422,
            body: 'O Bot do Discord não tem permissão para postar em nenhum canal de texto do servidor. Conceda a permissão de Enviar Mensagens ao bot no Discord.',
          }
        );
      }
    }
    return results;
  },

  async validateMedia(items) {
    const base = checkMediaRules(items, discordProvider.capabilities.media, { allowMixed: true });
    if (!base.ok) return base;
    for (const item of items) {
      if (item.media.length > MAX_ATTACHMENTS) {
        return { ok: false, reason: `máximo de ${MAX_ATTACHMENTS} anexos por post` };
      }
    }
    return { ok: true };
  },

  classifyError(status, body) {
    if (status === 403 && (body.includes('50001') || body.includes('50013') || body.includes('Missing Access') || body.includes('Missing Permissions') || /Unknown Channel/i.test(body))) {
      return 'permanent';
    }
    if (status === 401 || status === 403 || /Unknown Channel/i.test(body)) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
