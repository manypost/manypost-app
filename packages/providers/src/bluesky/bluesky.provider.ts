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

// Derived from Postiz (AGPL-3.0): direção do bluesky.provider.ts (app password, sem OAuth,
// sobre o AT Protocol). Implementação própria dos endpoints com.atproto.* / app.bsky.*.

const DEFAULT_SERVICE = 'https://bsky.social';
const POST_COLLECTION = 'app.bsky.feed.post';
/** Bluesky conta 300 graphemes; length é aproximação conservadora suficiente p/ o composer. */
const MAX_GRAPHEMES = 300;

const fieldsSchema = z.object({
  handle: z
    .string()
    .min(1)
    .transform((h) => h.trim().replace(/^@/, '')),
  appPassword: z.string().min(1),
  /** PDS custom (self-host do atproto); default bsky.social */
  service: z
    .string()
    .url()
    .transform((u) => u.replace(/\/+$/, ''))
    .optional(),
});

const settingsSchema = z.object({
  langs: z
    .array(z.string())
    .default(['pt'])
    .describe('Idiomas do post (BCP-47) — melhora distribuição/tradução no cliente'),
});

const serviceOf = (settings: unknown) =>
  ((settings ?? {}) as { service?: string }).service ?? DEFAULT_SERVICE;

async function xrpc<T>(
  ctx: ProviderContext,
  service: string,
  method: string,
  init: { token?: string; body?: unknown; query?: Record<string, string>; procedure?: boolean },
): Promise<T> {
  // No AT Protocol o método HTTP segue o tipo do lexicon: query → GET, procedure → POST.
  // A maioria das procedures manda body, mas refreshSession é POST *sem* body (o refreshJwt
  // vai no header), então não dá p/ inferir o método só pela presença de body — daí `procedure`.
  const hasBody = init.body !== undefined;
  const isPost = hasBody || init.procedure === true;
  const qs = init.query ? `?${new URLSearchParams(init.query)}` : '';
  const res = await ctx.fetch(`${service}/xrpc/${method}${qs}`, {
    method: isPost ? 'POST' : 'GET',
    headers: {
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
  return (await res.json()) as T;
}

interface Session {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

interface BlobRef {
  blob: unknown; // opaco: repassado tal qual ao createRecord
}

interface StrongRef {
  uri: string;
  cid: string;
}

const rkeyOf = (uri: string) => uri.split('/').pop() ?? '';
const releaseUrl = (handle: string, uri: string) =>
  `https://bsky.app/profile/${handle}/post/${rkeyOf(uri)}`;

/** Sobe cada imagem como blob e monta o embed app.bsky.embed.images. */
async function buildImageEmbed(
  ctx: ProviderContext,
  service: string,
  token: string,
  media: MediaRef[],
): Promise<unknown | undefined> {
  if (media.length === 0) return undefined;
  const images = [];
  for (const m of media) {
    const src = await ctx.fetch(m.url, { signal: AbortSignal.timeout(60_000) });
    if (!src.ok) throw { status: 422, body: `mídia inacessível para o worker: HTTP ${src.status}` };
    const bytes = await src.arrayBuffer();
    const res = await ctx.fetch(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': m.mime ?? 'application/octet-stream',
      },
      body: bytes,
    });
    if (!res.ok) throw { status: res.status, body: (await res.text()).slice(0, 2000) };
    const { blob } = (await res.json()) as BlobRef;
    images.push({ image: blob, alt: m.alt ?? '' });
  }
  return { $type: 'app.bsky.embed.images', images };
}

async function createPost(
  ctx: ProviderContext,
  service: string,
  session: { did: string; handle: string; accessJwt: string },
  item: PublishItem,
  langs: string[],
  reply?: { root: StrongRef; parent: StrongRef },
): Promise<PublishResult> {
  const embed = await buildImageEmbed(ctx, service, session.accessJwt, item.media);
  const record = {
    $type: POST_COLLECTION,
    text: item.content,
    createdAt: ctx.now().toISOString(),
    langs,
    ...(embed ? { embed } : {}),
    ...(reply ? { reply } : {}),
  };
  const res = await xrpc<StrongRef>(ctx, service, 'com.atproto.repo.createRecord', {
    token: session.accessJwt,
    body: { repo: session.did, collection: POST_COLLECTION, record },
  });
  return { externalId: res.uri, releaseUrl: releaseUrl(session.handle, res.uri) };
}

interface FetchedPost {
  uri: string;
  cid: string;
  record?: { reply?: { root?: StrongRef } };
}

/** Resolve {uri, cid} de um post pelo AT-URI (necessário p/ encadear réplicas). */
async function fetchPost(
  ctx: ProviderContext,
  service: string,
  token: string,
  uri: string,
): Promise<FetchedPost> {
  const out = await xrpc<{ posts: FetchedPost[] }>(ctx, service, 'app.bsky.feed.getPosts', {
    token,
    query: { uris: uri },
  });
  const post = out.posts[0];
  if (!post) throw { status: 422, body: 'post pai não encontrado para encadear a réplica' };
  return post;
}

const refOf = (p: FetchedPost): StrongRef => ({ uri: p.uri, cid: p.cid });

/**
 * Publica com o accessJwt guardado (o worker só passa o accessToken; o refreshJwt fica
 * cifrado no canal). `getSession` valida o token e resolve did/handle p/ o createRecord.
 * NÃO renovamos aqui: o refreshJwt do atproto ROTACIONA a cada refreshSession e só o worker
 * persiste a rotação — refrescar num provider stateless invalidaria o token guardado.
 * accessJwt expirado → ExpiredToken/401 → classify='refresh-token' → o worker renova e persiste.
 */
async function currentSession(
  ctx: ProviderContext,
  service: string,
  token: TokenSet,
): Promise<{ did: string; handle: string; accessJwt: string }> {
  const s = await xrpc<{ did: string; handle: string }>(
    ctx,
    service,
    'com.atproto.server.getSession',
    { token: token.accessToken },
  );
  return { did: s.did, handle: s.handle, accessJwt: token.accessToken };
}

export const blueskyProvider: ChannelProvider = {
  id: 'bluesky',
  name: 'Bluesky',
  capabilities: {
    editor: 'plain',
    maxLength: () => MAX_GRAPHEMES,
    media: {
      // vídeo no Bluesky exige app.bsky.embed.video (job async) — fica p/ onda 2
      images: { maxCount: 4, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
      videos: { maxCount: 0, mimeTypes: [] },
    },
    threads: true,
    mentions: false,
    analytics: false,
    twoStepConnect: false,
    customInstance: true, // PDS custom via campo service
  },
  rateDefaults: {
    maxConcurrent: 3,
    // atproto: limites generosos; publicar bem abaixo do teto de createSession/record
    perChannelWindow: { limit: 30, windowSec: 300 },
  },
  settingsSchema,
  connectionFieldsSchema: fieldsSchema,

  async connectWithFields(ctx, { fields }) {
    const { handle, appPassword, service: svc } = fieldsSchema.parse(fields);
    const service = svc ?? DEFAULT_SERVICE;
    const session = await xrpc<Session & { email?: string }>(
      ctx,
      service,
      'com.atproto.server.createSession',
      { body: { identifier: handle, password: appPassword } },
    );
    // perfil p/ nome de exibição e avatar (best-effort — não bloqueia a conexão)
    const profile = await xrpc<{ displayName?: string; avatar?: string }>(
      ctx,
      service,
      'app.bsky.actor.getProfile',
      { token: session.accessJwt, query: { actor: session.did } },
    ).catch(() => ({}) as { displayName?: string; avatar?: string });

    return {
      accessToken: session.accessJwt,
      refreshToken: session.refreshJwt, // é com ele que o worker renova a sessão
      scopes: [],
      externalId: session.did,
      name: profile.displayName || session.handle,
      username: session.handle,
      ...(profile.avatar ? { avatarUrl: profile.avatar } : {}),
      ...(svc ? { channelSettings: { service } } : {}),
    };
  },

  async getAuthUrl() {
    throw { status: 422, body: 'bluesky conecta por handle + app password, não por OAuth' };
  },
  async exchangeCode() {
    throw { status: 422, body: 'bluesky conecta por handle + app password, não por OAuth' };
  },

  async refreshToken(ctx, refreshToken, settings) {
    const s = await xrpc<Session>(ctx, serviceOf(settings), 'com.atproto.server.refreshSession', {
      token: refreshToken,
      procedure: true,
    });
    return { accessToken: s.accessJwt, refreshToken: s.refreshJwt, scopes: [] };
  },

  async publish(ctx, token, items, rawSettings) {
    const service = serviceOf(rawSettings);
    const { langs } = settingsSchema.parse(rawSettings ?? {});
    const session = await currentSession(ctx, service, token);

    const results: PublishResult[] = [];
    let root: StrongRef | undefined;
    let parent: StrongRef | undefined;
    for (const item of items) {
      const reply = root && parent ? { root, parent } : undefined;
      const res = await createPost(ctx, service, session, item, langs, reply);
      const ref = { uri: res.externalId, cid: (await fetchPost(ctx, service, session.accessJwt, res.externalId)).cid };
      root = root ?? ref; // a raiz da thread é sempre o primeiro post
      parent = ref;
      results.push(res);
    }
    return results;
  },

  async publishReply(ctx, token, parentExternalId, item, rawSettings) {
    const service = serviceOf(rawSettings);
    const { langs } = settingsSchema.parse(rawSettings ?? {});
    const session = await currentSession(ctx, service, token);
    const parentPost = await fetchPost(ctx, service, session.accessJwt, parentExternalId);
    const parent = refOf(parentPost);
    // a raiz da thread é o root do pai (se ele já for réplica) ou o próprio pai
    const root = parentPost.record?.reply?.root ?? parent;
    return createPost(ctx, service, session, item, langs, { root, parent });
  },

  async validateMedia(items) {
    return checkMediaRules(items, blueskyProvider.capabilities.media);
  },

  classifyError(status, body) {
    // sessão expirada/inválida → renova via reconexão (app password)
    if (status === 401 || /ExpiredToken|InvalidToken/i.test(body)) return 'refresh-token';
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  },
};
