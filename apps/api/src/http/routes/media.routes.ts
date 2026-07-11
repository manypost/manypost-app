import { OpenAPIHono, z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError, MIME_BY_EXT, type MediaRecord } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

const serialize = (ctn: Container, m: MediaRecord) => ({
  id: m.id,
  url: ctn.storage.publicUrl(m.path),
  mime: m.mime,
  byteSize: m.byteSize,
  width: m.width,
  height: m.height,
  alt: m.alt,
  createdAt: m.createdAt.toISOString(),
});

export function mediaRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.post('/upload', async (c) => {
    const form = await c.req.formData().catch(() => {
      throw new DomainError(ErrorCodes.PostInvalidSettings, 'envie multipart/form-data com o campo "file"');
    });
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new DomainError(ErrorCodes.PostInvalidSettings, 'campo "file" (arquivo) é obrigatório');
    }
    const alt = form.get('alt');
    const record = await ctn.media.upload({
      orgId: c.get('principal').orgId,
      bytes: new Uint8Array(await file.arrayBuffer()),
      ...(typeof alt === 'string' && alt ? { alt } : {}),
    });
    return c.json(serialize(ctn, record), 201);
  });

  const FromUrlBody = z.object({ url: z.string().url(), alt: z.string().max(1500).optional() });
  app.post('/from-url', async (c) => {
    const body = FromUrlBody.parse(await c.req.json());
    const record = await ctn.media.fromUrl({
      orgId: c.get('principal').orgId,
      url: body.url,
      ...(body.alt ? { alt: body.alt } : {}),
    });
    return c.json(serialize(ctn, record), 201);
  });

  app.get('/', async (c) => {
    const limit = Number(c.req.query('limit') ?? 50);
    const items = await ctn.media.list(c.get('principal').orgId, {
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return c.json(items.map((m) => serialize(ctn, m)));
  });

  const AltBody = z.object({ alt: z.string().max(1500).nullable() });
  app.patch('/:id', async (c) => {
    const body = AltBody.parse(await c.req.json());
    await ctn.media.setAlt(c.get('principal').orgId, c.req.param('id'), body.alt);
    return c.body(null, 204);
  });

  app.delete('/:id', async (c) => {
    await ctn.media.remove(c.get('principal').orgId, c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}

const ORG_RE = /^[0-9a-f-]{36}$/i;
const FILE_RE = /^([0-9a-f-]{36})\.([a-z0-9]{2,5})$/i;

/**
 * Servir uploads do storage local (SEM auth): as redes precisam baixar a mídia por URL pública
 * (IG exige; Mastodon baixa via worker). Chaves são UUIDs — não enumeráveis.
 */
export function publicUploadRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  app.get('/:org/:file', async (c) => {
    const org = c.req.param('org');
    const file = c.req.param('file');
    const ext = FILE_RE.exec(file)?.[2]?.toLowerCase();
    if (!ORG_RE.test(org) || !ext) return c.notFound();
    const bytes = await ctn.storage.read(`${org}/${file}`);
    if (!bytes) return c.notFound();
    return new Response(bytes, {
      headers: {
        'content-type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    });
  });
  return app;
}
