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
}

export interface RateDefaults {
  /** Derived from Postiz (AGPL-3.0): valores maxConcurrentJob por provider */
  maxConcurrent: number;
  perChannelWindow?: { limit: number; windowSec: number };
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

export interface PublishItem {
  content: string;
  media: { type: 'image' | 'video'; url: string; alt?: string; thumbnailUrl?: string }[];
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
}

export interface ChannelProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ChannelCapabilities;
  readonly rateDefaults: RateDefaults;
  readonly settingsSchema: ZodType;
  readonly connectionFieldsSchema?: ZodType;

  getAuthUrl(
    ctx: ProviderContext,
    input: { redirectUri: string },
  ): Promise<{ url: string; state: string; codeVerifier?: string }>;
  exchangeCode(
    ctx: ProviderContext,
    input: { code: string; codeVerifier?: string; redirectUri: string },
  ): Promise<TokenSet & ExternalAccount>;
  refreshToken(ctx: ProviderContext, refreshToken: string): Promise<TokenSet>;
  listSubAccounts?(ctx: ProviderContext, token: TokenSet): Promise<ExternalAccount[]>;

  publish(
    ctx: ProviderContext,
    token: TokenSet,
    items: PublishItem[],
    settings: unknown,
  ): Promise<PublishResult[]>;
  publishReply?(
    ctx: ProviderContext,
    token: TokenSet,
    parentExternalId: string,
    item: PublishItem,
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
