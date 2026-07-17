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

// Derived from Postiz (AGPL-3.0): direção do telegram.provider.ts (bot da instalação publica
// em canal/grupo onde é admin). Implementação própria sobre a Bot API; conexão por @/id do chat
// em vez de polling de getUpdates (guia leigo: docs/INTEGRATIONS_SETUP.md §2.3).

const API = 'https://api.telegram.org';

/** @canal, t.me/canal ou id numérico (grupos são negativos, ex.: -100123...). */
const fieldsSchema = z.object({
  chat: z
    .string()
    .min(2)
    .transform((s) => s.trim().replace(/^https?:\/\/t\.me\//, '@').replace(/^@@/, '@'))
    .describe('Canal ou grupo onde o bot da instalação é administrador — @nome, link t.me/… ou id numérico'),
});

const settingsSchema = z.object({
  disableLinkPreview: z
    .boolean()
    .default(false)
    .describe('Não mostrar o preview de link no post'),
  silent: z
    .boolean()
    .default(false)
    .describe('Entrega silenciosa (sem som de notificação para os inscritos)'),
});

interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

interface TgMessage {
  message_id: number;
  chat: TgChat;
}

/** Bot API sempre responde 200/4xx com {ok, result|description, parameters?}. */
async function api<T>(
  ctx: ProviderContext,
  botToken: string,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await ctx.fetch(`${API}/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = (await res.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; error_code: number; description: string; parameters?: { retry_after?: number } }
    | null;
  if (!json) throw { status: res.status, body: 'resposta inválida da Bot API' };
  if (!json.ok) {
    // 429 vem com retry_after; mantemos no body p/ diagnóstico (retry usa backoff próprio)
    const retry = json.parameters?.retry_after ? ` (retry_after=${json.parameters.retry_after}s)` : '';
    throw { status: json.error_code, body: `${json.description}${retry}` };
  }
  return json.result;
}

const botTokenOf = (token: TokenSet) => token.accessToken;

const releaseUrlOf = (chat: { username?: string | undefined }, messageId: number) =>
  chat.username ? `https://t.me/${chat.username}/${messageId}` : undefined;

async function sendItem(
  ctx: ProviderContext,
  botToken: string,
  chatId: number | string,
  item: PublishItem,
  settings: { disableLinkPreview: boolean; silent: boolean },
  replyTo?: number,
): Promise<PublishResult> {
  const common = {
    chat_id: chatId,
    disable_notification: settings.silent,
    ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}),
  };
  const mediaOf = (m: MediaRef) => (m.type === 'image' ? 'photo' : 'video');

  let msg: TgMessage;
  if (item.media.length === 0) {
    msg = await api<TgMessage>(ctx, botToken, 'sendMessage', {
      ...common,
      text: item.content,
      link_preview_options: { is_disabled: settings.disableLinkPreview },
    });
  } else if (item.media.length === 1) {
    const m = item.media[0]!;
    // a Bot API baixa a mídia da URL pública (nossa /uploads) — sem upload de bytes
    msg = await api<TgMessage>(ctx, botToken, m.type === 'image' ? 'sendPhoto' : 'sendVideo', {
      ...common,
      [mediaOf(m)]: m.url,
      ...(item.content ? { caption: item.content } : {}),
    });
  } else {
    // álbum: caption apenas no primeiro item (regra da Bot API)
    const msgs = await api<TgMessage[]>(ctx, botToken, 'sendMediaGroup', {
      ...common,
      media: item.media.map((m, i) => ({
        type: mediaOf(m),
        media: m.url,
        ...(i === 0 && item.content ? { caption: item.content } : {}),
      })),
    });
    msg = msgs[0]!;
  }
  const url = releaseUrlOf(msg.chat, msg.message_id);
  return {
    externalId: String(msg.message_id),
    ...(url ? { releaseUrl: url } : {}),
  };
}

function parseSettings(rawSettings: unknown) {
  const { chatId, chatUsername, ...rest } = (rawSettings ?? {}) as {
    chatId?: number | string;
    chatUsername?: string;
  };
  if (chatId === undefined) throw { status: 422, body: 'canal sem chatId configurado — reconecte' };
  return { chatId, chatUsername, ...settingsSchema.parse(rest) };
}

export const telegramProvider: ChannelProvider = {
  id: 'telegram',
  name: 'Telegram',
  capabilities: {
    editor: 'plain',
    // 4096 p/ texto; com mídia o limite de caption é 1024 — a Bot API recusa acima (erro claro)
    maxLength: () => 4096,
    media: {
      images: { maxCount: 10, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
      videos: { maxCount: 10, mimeTypes: ['video/mp4'] },
    },
    threads: true, // réplicas via reply_parameters
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    maxConcurrent: 2,
    // Bot API: ~20 msg/min por grupo/canal; 30 msg/s global do bot
    perChannelWindow: { limit: 18, windowSec: 60 },
    perProviderWindow: { limit: 25, windowSec: 1 },
  },
  settingsSchema,
  connectionFieldsSchema: fieldsSchema,
  requiredSecrets: ['botToken'],

  /** Conexão: valida que o bot da instalação é admin do chat e pode publicar. */
  async connectWithFields(ctx, { fields }) {
    const botToken = ctx.secrets.botToken;
    if (!botToken) throw { status: 422, body: 'TELEGRAM_BOT_TOKEN ausente no servidor' };
    const { chat: chatRef } = fieldsSchema.parse(fields);
    const chatId: string | number = /^-?\d+$/.test(chatRef) ? Number(chatRef) : chatRef;

    const chat = await api<TgChat>(ctx, botToken, 'getChat', { chat_id: chatId });
    if (chat.type === 'private') {
      throw { status: 422, body: 'conecte um canal ou grupo (não uma conversa privada)' };
    }
    const me = await api<{ id: number; username: string }>(ctx, botToken, 'getMe', {});
    const member = await api<{ status: string; can_post_messages?: boolean }>(
      ctx,
      botToken,
      'getChatMember',
      { chat_id: chat.id, user_id: me.id },
    );
    const isAdmin = member.status === 'administrator' || member.status === 'creator';
    if (chat.type === 'channel' && (!isAdmin || member.can_post_messages === false)) {
      throw {
        status: 422,
        body: `o bot @${me.username} precisa ser administrador do canal com permissão de publicar`,
      };
    }
    if (!isAdmin && member.status !== 'member') {
      throw { status: 422, body: `adicione o bot @${me.username} ao grupo antes de conectar` };
    }

    return {
      // o token do canal é o token do bot, cifrado at-rest como os demais — o publish
      // não depende de env (trocar o bot depois = reconectar os canais)
      accessToken: botToken,
      scopes: [],
      externalId: String(chat.id),
      name: chat.title ?? chat.username ?? String(chat.id),
      ...(chat.username ? { username: chat.username } : {}),
      channelSettings: {
        chatId: chat.id,
        ...(chat.username ? { chatUsername: chat.username } : {}),
        chatType: chat.type,
      },
    };
  },

  async getAuthUrl() {
    throw { status: 422, body: 'telegram conecta por campos (bot + chat), não por OAuth' };
  },
  async exchangeCode() {
    throw { status: 422, body: 'telegram conecta por campos (bot + chat), não por OAuth' };
  },
  async refreshToken() {
    throw new Error('token de bot do Telegram não expira'); // 401 = bot removido → reconexão
  },

  async publish(ctx, token, items, rawSettings) {
    const cfg = parseSettings(rawSettings);
    const results: PublishResult[] = [];
    let replyTo: number | undefined;
    for (const item of items) {
      const res = await sendItem(ctx, botTokenOf(token), cfg.chatId, item, cfg, replyTo);
      replyTo = Number(res.externalId);
      results.push(res);
    }
    return results;
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    const cfg = parseSettings(rawSettings);
    return sendItem(ctx, botTokenOf(token), cfg.chatId, item, cfg, Number(parentExternalId));
  },

  async validateMedia(items) {
    // Telegram aceita álbum misto de fotos e vídeos
    return checkMediaRules(items, telegramProvider.capabilities.media, { allowMixed: true });
  },

  classifyError(status) {
    // 401/403 = token inválido ou bot removido do chat → reconexão manual
    if (status === 401 || status === 403) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
