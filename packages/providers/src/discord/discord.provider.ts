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
// pelo usuário), sem OAuth nem bot token no servidor — 100% sem gate (guia: docs/INTEGRATIONS_SETUP.md §3.1).

/** Discord conta 2000 caracteres por mensagem; acima disso a API recusa (400 = permanente). */
const MAX_LEN = 2000;
/** flags aceitas no Execute Webhook (Discord): SUPPRESS_EMBEDS = 1<<2, SUPPRESS_NOTIFICATIONS = 1<<12. */
const SUPPRESS_EMBEDS = 1 << 2;
const SUPPRESS_NOTIFICATIONS = 1 << 12;
/** Discord aceita no máximo 10 anexos por mensagem (imagens + vídeos somados). */
const MAX_ATTACHMENTS = 10;

/**
 * URL de webhook do Discord: `https://discord.com/api/webhooks/{id}/{token}`.
 * Aceita os hosts alternativos (discordapp.com, ptb./canary.) e o prefixo de versão (/v10).
 */
const WEBHOOK_RE =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)\/?$/;

const fieldsSchema = z.object({
  webhookUrl: z
    .string()
    .trim()
    .refine((u) => WEBHOOK_RE.test(u), 'cole a URL do webhook do canal (Config do servidor → Integrações → Webhooks)'),
});

const settingsSchema = z.object({
  /** não expande previews de link no post (equivale ao SUPPRESS_EMBEDS) */
  suppressEmbeds: z.boolean().default(false),
  /** entrega silenciosa, sem push para os membros (SUPPRESS_NOTIFICATIONS) */
  silent: z.boolean().default(false),
});

/** Reconstrói a URL canônica a partir do id+token (descarta host alternativo/versão). */
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

/**
 * Executa o webhook (`?wait=true` p/ receber a mensagem criada e resolver o externalId).
 * Sem mídia = JSON; com mídia = multipart (payload_json + files[i]), a mesma forma do Postiz.
 * O worker baixa os bytes da URL pública (nossa /uploads) via ctx.fetch e sobe no anexo.
 */
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
    // content-type (multipart boundary) fica a cargo do runtime — não setar à mão
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

export const discordProvider: ChannelProvider = {
  id: 'discord',
  name: 'Discord',
  capabilities: {
    editor: 'markdown', // Discord renderiza markdown na mensagem
    maxLength: () => MAX_LEN,
    media: {
      images: { maxCount: MAX_ATTACHMENTS, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] },
      videos: { maxCount: MAX_ATTACHMENTS, mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'] },
    },
    // incoming webhook não cria thread nem responde a mensagem (precisaria de bot token) — onda 2
    threads: false,
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    // Discord: ~5 req/2s por webhook e ~30 msg/min por canal; publicar bem abaixo do teto
    maxConcurrent: 5,
    perChannelWindow: { limit: 25, windowSec: 60 },
  },
  settingsSchema,
  connectionFieldsSchema: fieldsSchema,

  /** Conexão: valida a URL do webhook (GET devolve o canal/servidor de destino). */
  async connectWithFields(ctx, { fields }) {
    const { webhookUrl } = fieldsSchema.parse(fields);
    const [, id, secret] = WEBHOOK_RE.exec(webhookUrl)!;
    const url = canonicalUrl(id!, secret!);

    const res = await ctx.fetch(url);
    if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
    const hook = (await res.json()) as Webhook;

    return {
      // o "token" do canal é a própria URL do webhook (contém o secret), cifrada at-rest
      accessToken: url,
      scopes: [],
      externalId: hook.channel_id, // o canal é o alvo — trocar o webhook do mesmo canal reconecta
      name: hook.name || `Discord ${hook.channel_id}`,
      channelSettings: {
        channelId: hook.channel_id,
        ...(hook.guild_id ? { guildId: hook.guild_id } : {}),
      },
    };
  },

  async getAuthUrl() {
    throw { status: 422, body: 'discord conecta por URL de webhook, não por OAuth' };
  },
  async exchangeCode() {
    throw { status: 422, body: 'discord conecta por URL de webhook, não por OAuth' };
  },
  async refreshToken() {
    // webhook não tem refresh: 401/404 = webhook removido → reconexão manual (nova URL)
    throw new Error('webhook do Discord não emite refresh token');
  },

  async publish(ctx, token: TokenSet, items, rawSettings) {
    const cfg = parseSettings(rawSettings);
    // threads:false ⇒ o agendamento nunca gera itens de thread p/ Discord; mesmo assim,
    // por robustez, cada item vira uma mensagem independente (sem encadear — webhook não responde)
    const results: PublishResult[] = [];
    for (const item of items) {
      results.push(await executeWebhook(ctx, token.accessToken, cfg.guildId, item, cfg.flags));
    }
    return results;
  },

  async validateMedia(items) {
    const base = checkMediaRules(items, discordProvider.capabilities.media, { allowMixed: true });
    if (!base.ok) return base;
    // teto combinado do Discord: 10 anexos por mensagem, independentemente do tipo
    for (const item of items) {
      if (item.media.length > MAX_ATTACHMENTS) {
        return { ok: false, reason: `máximo de ${MAX_ATTACHMENTS} anexos por post` };
      }
    }
    return { ok: true };
  },

  classifyError(status, body) {
    // 401 (token inválido) e 404 (Unknown Webhook = webhook apagado) → reconexão manual
    if (status === 401 || status === 404 || /Unknown Webhook/i.test(body)) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
