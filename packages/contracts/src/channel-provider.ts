// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/social.integrations.interface.ts
// Contrato do provider de canal — SPEC_INTEGRATIONS §2.
import type { ZodType } from 'zod';

export type ErrorClass = 'transient' | 'refresh-token' | 'permanent';

export interface MediaRule {
  maxCount: number;
  mimeTypes: string[];
  maxBytes?: number;
  minWidth?: number;
  minHeight?: number;
  maxDurationSec?: number;
}

export interface ChannelCapabilities {
  editor: 'plain' | 'rich' | 'markdown' | 'html';
  maxLength: (settings?: unknown) => number;
  media: { images: MediaRule; videos: MediaRule };
  threads: boolean;
  mentions: boolean;
  analytics: boolean;
  twoStepConnect: boolean;
  customInstance: boolean;
  /** rede que NÃO aceita post só-texto (ex.: TikTok exige um vídeo ou foto) — ausente/false = texto puro ok */
  requiresMedia?: boolean;
}

export interface RateWindow {
  limit: number;
  windowSec: number;
}

export interface RateDefaults {
  /** Derived from Postiz (AGPL-3.0): valores maxConcurrentJob por provider */
  maxConcurrent: number;
  /** janela global do provider (todas as contas da instalação) */
  perProviderWindow?: RateWindow;
  /** janela por conta conectada */
  perChannelWindow?: RateWindow;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO
  scopes: string[];
}

export interface ExternalAccount {
  externalId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}

/** Sub-conta/canal selecionável de uma conta já conectada (ex.: canal de texto de um
 *  servidor Discord, página de uma conta LinkedIn). `channelSettings` é gravado no canal
 *  ao selecionar a sub-conta (guildId/channelId etc.). */
export interface SubAccount extends ExternalAccount {
  channelSettings?: Record<string, unknown>;
}

/** Token de um canal já conectado + identidade da conta — entrada de `listSubAccounts`
 *  (o worker/rota decifra o token e repassa a identidade gravada no upsert). */
export type ConnectedToken = TokenSet & {
  externalId: string;
  name?: string;
  channelSettings?: Record<string, unknown>;
};

/** Referência de mídia anexada a um item de publicação (content jsonb / PublishItem). */
export interface MediaRef {
  type: 'image' | 'video';
  url: string;
  /** MIME real detectado por magic bytes no upload — presente quando a mídia veio da biblioteca */
  mime?: string;
  alt?: string;
  thumbnailUrl?: string;
  /** id na tabela media, quando aplicável */
  mediaId?: string;
}

export interface PublishItem {
  content: string;
  media: MediaRef[];
}

export interface PublishResult {
  externalId: string;
  releaseUrl?: string;
}

export interface Mention {
  id: string;
  label: string;
  imageUrl?: string;
}

export interface MetricPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface MetricSeries {
  metric: string;
  points: MetricPoint[];
}

/** Contexto injetado — providers nunca usam fetch global nem leem env (SPEC_INTEGRATIONS §2). */
export interface ProviderContext {
  fetch: typeof fetch;
  log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, data?: object) => void;
  now: () => Date;
  secrets: Record<string, string>;
  /**
   * Chave opaca e estável do item lógico em publicação: o MESMO valor em toda retentativa da
   * mesma (publicação, versão de job, posição). Provider cuja API desduplica por chave deve
   * repassá-la e declarar `idempotentPublish` — é o que torna seguro retentar depois de um
   * resultado incerto. Não contém conteúdo, id interno nem segredo (é um hash). Ausente em
   * chamadas fora do caminho de publicação (connect, refresh, sub-contas).
   */
  idempotencyKey?: string;
}

export interface ChannelProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ChannelCapabilities;
  readonly rateDefaults: RateDefaults;
  readonly settingsSchema: ZodType;
  readonly connectionFieldsSchema?: ZodType;
  /** chaves de ctx.secrets exigidas p/ o provider estar disponível (ex.: botToken via env) */
  readonly requiredSecrets?: string[];
  /**
   * Chaves de settings cujo valor guardado é um **id de mídia da org** (não um valor literal). A
   * plataforma resolve cada uma para a URL pública ANTES de chamar `publish` — o provider recebe a
   * URL, nunca o id. O valor persistido continua sendo o id (o post segue editável). Resolução
   * org-scoped: id de outra org não resolve e o campo fica ausente. Ver SPEC_INTEGRATIONS.
   */
  readonly mediaSettings?: readonly string[];
  /**
   * A API da rede desduplica publicações pela `ctx.idempotencyKey` que este provider repassa.
   * Só declare quando a chave for de fato enviada e honrada pela rede: com ela, um erro de
   * transporte (timeout, conexão derrubada) vira retentativa; sem ela, vira revisão humana,
   * porque a chamada pode ter sido aceita sem que a confirmação chegasse (SPEC_QUEUE §7).
   */
  readonly idempotentPublish?: boolean;

  /** Conexão direta por credenciais (Bluesky app password, Telegram bot) — sem redirect
   *  OAuth (SPEC_INTEGRATIONS §5). Presente = o connect usa este caminho e ignora getAuthUrl. */
  connectWithFields?(
    ctx: ProviderContext,
    input: { fields: unknown },
  ): Promise<TokenSet & ExternalAccount & { channelSettings?: Record<string, unknown> }>;

  getAuthUrl(
    ctx: ProviderContext,
    input: { redirectUri: string; fields?: unknown },
  ): Promise<{ url: string; state: string; codeVerifier?: string; extra?: unknown }>;
  exchangeCode(
    ctx: ProviderContext,
    input: { code: string; codeVerifier?: string; redirectUri: string; extra?: unknown },
  ): Promise<TokenSet & ExternalAccount & { channelSettings?: Record<string, unknown> }>;
  /** settings = merge canal+publicação (ex.: service do PDS no Bluesky, instance no Mastodon) */
  refreshToken(ctx: ProviderContext, refreshToken: string, settings?: unknown): Promise<TokenSet>;
  listSubAccounts?(ctx: ProviderContext, token: ConnectedToken): Promise<SubAccount[]>;

  publish(
    ctx: ProviderContext,
    token: TokenSet,
    items: PublishItem[],
    settings: unknown,
  ): Promise<PublishResult[]>;
  /** Publica um item de thread em resposta ao anterior — obrigatório quando capabilities.threads. */
  publishReply?(
    ctx: ProviderContext,
    token: TokenSet,
    parentExternalId: string,
    item: PublishItem,
    settings?: unknown,
  ): Promise<PublishResult>;
  validateMedia(items: PublishItem[]): Promise<{ ok: true } | { ok: false; reason: string }>;
  classifyError(status: number, body: string): ErrorClass;

  searchMentions?(ctx: ProviderContext, token: TokenSet, query: string): Promise<Mention[]>;
  formatMention?(m: Mention): string;
  fetchAnalytics?(
    ctx: ProviderContext,
    token: TokenSet,
    range: { from: string; to: string },
  ): Promise<MetricSeries[]>;
  fetchPostAnalytics?(
    ctx: ProviderContext,
    token: TokenSet,
    externalId: string,
  ): Promise<MetricSeries[]>;
}
