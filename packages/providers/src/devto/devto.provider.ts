import { z } from 'zod';
import type {
  ChannelProvider,
  ProviderContext,
  PublishItem,
  PublishResult,
  SubAccount,
  TokenSet,
} from '@manypost/contracts';
import { checkMediaRules } from '../shared/media-rules';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/dev.to.provider.ts
// (conexão por API key pessoal, POST /api/articles com body_markdown, organizações derivadas dos
// artigos do autor). Divergências deliberadas, registradas em openspec/changes/add-devto-provider:
// a capa vem da mídia anexada (não de um campo de settings) e o título é obrigatório no schema,
// o que faz a validação falhar no AGENDAMENTO em vez de no publish.

const API = 'https://dev.to/api';

/** Artigo longo: o limite existe para o contador da UI, não é uma trava da plataforma. */
const MAX_LEN = 100_000;
const MAX_TAGS = 4;

const fieldsSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(3)
    .describe('Chave de API do Dev.to (Settings → Extensions → DEV Community API Keys)'),
});

const settingsSchema = z.object({
  // único campo obrigatório de settings em todo o app: um artigo sem título não existe, e o
  // título não é derivável do corpo — melhor recusar no composer que falhar no horário agendado
  title: z.string().trim().min(2).max(250).describe('Título do artigo'),
  tags: z
    .array(z.string().trim().min(1))
    .max(MAX_TAGS)
    .optional()
    .describe(`Até ${MAX_TAGS} tags, sem o "#"`),
  canonicalUrl: z
    .string()
    .trim()
    .url()
    .optional()
    .describe('Endereço original do texto, se ele já foi publicado em outro lugar'),
  organizationId: z
    .string()
    .trim()
    .optional()
    .describe('Publicar pela organização, em vez do perfil pessoal'),
});

interface DevtoUser {
  id: number;
  name?: string;
  username?: string;
  profile_image?: string;
}

interface DevtoArticle {
  id: number;
  url?: string;
}

interface DevtoOrganization {
  id: number;
  name?: string;
  username?: string;
}

async function api<T>(
  ctx: ProviderContext,
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await ctx.fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), 'api-key': apiKey },
  });
  if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  return (await res.json()) as T;
}

export const devtoProvider: ChannelProvider = {
  id: 'devto',
  name: 'Dev.to',
  capabilities: {
    editor: 'markdown',
    maxLength: () => MAX_LEN,
    media: {
      // uma imagem só, e ela é a CAPA do artigo — imagem no corpo o autor escreve em markdown
      images: { maxCount: 1, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] },
      videos: { maxCount: 0, mimeTypes: [] },
    },
    threads: false,
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: false,
  },
  rateDefaults: {
    // Derived from Postiz (AGPL-3.0): maxConcurrentJob = 3
    maxConcurrent: 3,
    perChannelWindow: { limit: 10, windowSec: 60 },
  },
  settingsSchema,
  connectionFieldsSchema: fieldsSchema,
  requiredSecrets: [],

  /** Conexão: a key pessoal é o token do canal (cifrada at-rest); validada contra /users/me. */
  async connectWithFields(ctx, { fields }) {
    const { apiKey } = fieldsSchema.parse(fields);
    const me = await api<DevtoUser>(ctx, apiKey, '/users/me');
    return {
      accessToken: apiKey,
      scopes: [],
      externalId: String(me.id),
      name: me.name || me.username || `Dev.to ${me.id}`,
      ...(me.username ? { username: me.username } : {}),
      ...(me.profile_image ? { avatarUrl: me.profile_image } : {}),
    };
  },

  async getAuthUrl() {
    throw { status: 422, body: 'dev.to conecta por chave de API, não por OAuth' };
  },
  async exchangeCode() {
    throw { status: 422, body: 'dev.to conecta por chave de API, não por OAuth' };
  },
  async refreshToken() {
    // a key não expira; 401 aqui significa key revogada → canal vai a REFRESH_REQUIRED
    throw new Error('chave de API do Dev.to não é renovável — cole uma nova chave');
  },

  /** Organizações do autor. A API do Forem não lista "minhas organizações": o caminho possível
   *  é olhar os artigos já publicados. Autor sem artigo em organização vê lista vazia — o campo
   *  é opcional e o padrão é o perfil pessoal, então isso degrada para o caso comum. */
  async listSubAccounts(ctx, token) {
    let articles: Array<{ organization?: { username?: string } }>;
    try {
      articles = await api(ctx, token.accessToken, '/articles/me/all?per_page=1000');
    } catch {
      return []; // lista de conveniência: falhar aqui travaria o composer inteiro
    }
    const usernames = [
      ...new Set(articles.map((a) => a?.organization?.username).filter((u): u is string => !!u)),
    ];
    const orgs = await Promise.all(
      usernames.map((u) =>
        api<DevtoOrganization>(ctx, token.accessToken, `/organizations/${u}`).catch(() => null),
      ),
    );
    return orgs.filter((o): o is DevtoOrganization => !!o).map(
      (o): SubAccount => ({
        externalId: String(o.id),
        name: o.name || o.username || String(o.id),
        ...(o.username ? { username: o.username } : {}),
      }),
    );
  },

  async publish(ctx, token: TokenSet, items, rawSettings) {
    const cfg = settingsSchema.parse(rawSettings ?? {});
    const item = items[0] as PublishItem;
    const cover = item.media.find((m) => m.type === 'image');
    const orgId = cfg.organizationId ? Number(cfg.organizationId) : undefined;

    const article = await api<DevtoArticle>(ctx, token.accessToken, '/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        article: {
          title: cfg.title,
          body_markdown: item.content,
          published: true,
          ...(cover ? { main_image: cover.url } : {}),
          ...(cfg.tags?.length ? { tags: cfg.tags } : {}),
          ...(cfg.canonicalUrl ? { canonical_url: cfg.canonicalUrl } : {}),
          ...(orgId !== undefined && Number.isFinite(orgId) ? { organization_id: orgId } : {}),
        },
      }),
    });

    // resposta já traz id e url — nenhuma chamada depois do artigo publicado (nada pode lançar aqui)
    const result: PublishResult = {
      externalId: String(article.id),
      ...(article.url ? { releaseUrl: article.url } : {}),
    };
    return [result];
  },

  async validateMedia(items) {
    return checkMediaRules(items, devtoProvider.capabilities.media);
  },

  classifyError(status) {
    // key revogada/sem permissão → pedir chave nova (não há refresh)
    if (status === 401 || status === 403) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
