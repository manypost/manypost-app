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

// Derived from Postiz (AGPL-3.0): direção do discord.provider.ts (publicar num canal via
// FormData com payload_json + files[]). Aqui a conexão é por *incoming webhook* (URL colada
// pelo usuário), sem OAuth nem bot token no servidor — alternativa leve p/ self-hosted sem app.

const MAX_LEN = 2000;
const SUPPRESS_EMBEDS = 1 << 2;
const SUPPRESS_NOTIFICATIONS = 1 << 12;
const MAX_ATTACHMENTS = 10;

const WEBHOOK_RE =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)\/?$/;

const fieldsSchema = z.object({
  webhookUrl: z
    .string()
    .trim()
    .refine((u) => WEBHOOK_RE.test(u), 'cole a URL do webhook do canal (Config do servidor → Integrações → Webhooks)')
    .describe('URL de webhook do canal (Config do servidor → Integrações → Webhooks → Copiar URL)'),
});

const settingsSchema = z.object({
  suppressEmbeds: z
    .boolean()
    .default(false)
    .describe('Não expandir previews de link no post (SUPPRESS_EMBEDS)'),
  silent: z
    .boolean()
    .default(false)
    .describe('Entrega silenciosa, sem push para os membros (SUPPRESS_NOTIFICATIONS)'),
});

const canonicalUrl = (id: string, token: string) =>
  `https://discord.com/api/webhooks/${id}/${token}`;

interface Webhook {
  id: string;
  name?: string;
  channel_id: string;
  guild_id?: string;
}

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

async function executeWebhook(
  ctx: ProviderContext,
  webhookUrl: string,
  guildId: string | undefined,
  item: PublishItem,
  flags: number,
): Promise<PublishResult> {
  const url = `${webhookUrl}?wait=true`;
  const flagField = flags ? { flags } : {};

  let res: Response;
  if (item.media.length === 0) {
    res = await ctx.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    res = await ctx.fetch(url, { method: 'POST', body: form });
  }

  if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  const msg = (await res.json()) as DiscordMessage;
  const releaseUrl = releaseUrlOf(guildId, msg.channel_id, msg.id);
  return { externalId: msg.id, ...(releaseUrl ? { releaseUrl } : {}) };
}

function parseSettings(rawSettings: unknown) {
  const { guildId, channelId, ...rest } = (rawSettings ?? {}) as {
    guildId?: string;
    channelId?: string;
  };
  const { suppressEmbeds, silent } = settingsSchema.parse(rest);
  const flags = (suppressEmbeds ? SUPPRESS_EMBEDS : 0) | (silent ? SUPPRESS_NOTIFICATIONS : 0);
  return { guildId, channelId, flags };
}

export const discordWebhookProvider: ChannelProvider = {
  id: 'discord-webhook',
  name: 'Discord (Webhook)',
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
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    maxConcurrent: 5,
    perChannelWindow: { limit: 25, windowSec: 60 },
  },
  settingsSchema,
  connectionFieldsSchema: fieldsSchema,

  async connectWithFields(ctx, { fields }) {
    const { webhookUrl } = fieldsSchema.parse(fields);
    const [, id, secret] = WEBHOOK_RE.exec(webhookUrl)!;
    const url = canonicalUrl(id!, secret!);

    const res = await ctx.fetch(url);
    if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
    const hook = (await res.json()) as Webhook;

    return {
      accessToken: url,
      scopes: [],
      externalId: hook.channel_id,
      name: hook.name || `Discord ${hook.channel_id}`,
      channelSettings: {
        channelId: hook.channel_id,
        ...(hook.guild_id ? { guildId: hook.guild_id } : {}),
      },
    };
  },

  async getAuthUrl() {
    throw { status: 422, body: 'discord-webhook conecta por URL de webhook, não por OAuth' };
  },
  async exchangeCode() {
    throw { status: 422, body: 'discord-webhook conecta por URL de webhook, não por OAuth' };
  },
  async refreshToken() {
    throw new Error('webhook do Discord não emite refresh token');
  },

  async publish(ctx, token: TokenSet, items, rawSettings) {
    const cfg = parseSettings(rawSettings);
    const results: PublishResult[] = [];
    for (const item of items) {
      results.push(await executeWebhook(ctx, token.accessToken, cfg.guildId, item, cfg.flags));
    }
    return results;
  },

  async validateMedia(items) {
    const base = checkMediaRules(items, discordWebhookProvider.capabilities.media, { allowMixed: true });
    if (!base.ok) return base;
    for (const item of items) {
      if (item.media.length > MAX_ATTACHMENTS) {
        return { ok: false, reason: `máximo de ${MAX_ATTACHMENTS} anexos por post` };
      }
    }
    return { ok: true };
  },

  classifyError(status, body) {
    if (status === 401 || status === 404 || /Unknown Webhook/i.test(body)) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
