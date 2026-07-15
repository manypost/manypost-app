import { z } from '@hono/zod-openapi';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError, MIME_BY_EXT, type MediaRecord } from '@manypost/core';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses, jsonBody, jsonResponse } from '../openapi';

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

const MediaOut = z
  .object({
    id: z.string(),
    url: z.string().openapi({ description: 'URL pública (as redes baixam por aqui)' }),
    mime: z.string().openapi({ example: 'image/png' }),
    byteSize: z.number().int(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    alt: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('Media');

const UploadForm = z.object({
  file: z.string().openapi({ format: 'binary', description: 'arquivo (MIME real detectado por magic bytes)' }),
  alt: z.string().optional(),
});
const FromUrlBodySchema = z.object({ url: z.string().url(), alt: z.string().max(1500).optional() });
const AltBodySchema = z.object({ alt: z.string().max(1500).nullable() });
const IdParam = z.object({ id: z.string().uuid() });

export function mediaRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/upload',
    tags: ['media'],
    security: AUTH_SECURITY,
    summary: 'Envia mídia (multipart) — MIME real por magic bytes',
    request: { body: { required: true, content: { 'multipart/form-data': { schema: UploadForm } } } },
    responses: { 201: jsonResponse('mídia criada', MediaOut), ...errorResponses(400, 401) },
  });
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

  const FromUrlBody = FromUrlBodySchema;
  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/from-url',
    tags: ['media'],
    security: AUTH_SECURITY,
    summary: 'Importa mídia por URL (anti-SSRF, re-valida a cada redirect)',
    request: jsonBody(FromUrlBodySchema),
    responses: { 201: jsonResponse('mídia criada', MediaOut), ...errorResponses(400, 401) },
  });
  app.post('/from-url', async (c) => {
    const body = FromUrlBody.parse(await c.req.json());
    const record = await ctn.media.fromUrl({
      orgId: c.get('principal').orgId,
      url: body.url,
      ...(body.alt ? { alt: body.alt } : {}),
    });
    return c.json(serialize(ctn, record), 201);
  });

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/',
    tags: ['media'],
    security: AUTH_SECURITY,
    summary: 'Lista a biblioteca de mídia',
    request: { query: z.object({ limit: z.string().optional().openapi({ example: '50' }) }) },
    responses: { 200: jsonResponse('itens de mídia', z.array(MediaOut)), ...errorResponses(401) },
  });
  app.get('/', async (c) => {
    const limit = Number(c.req.query('limit') ?? 50);
    const items = await ctn.media.list(c.get('principal').orgId, {
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return c.json(items.map((m) => serialize(ctn, m)));
  });

  const AltBody = AltBodySchema;
  app.openAPIRegistry.registerPath({
    method: 'patch',
    path: '/{id}',
    tags: ['media'],
    security: AUTH_SECURITY,
    summary: 'Atualiza o texto alternativo (alt) de uma mídia',
    request: { params: IdParam, ...jsonBody(AltBodySchema) },
    responses: { 204: { description: 'alt atualizado' }, ...errorResponses(400, 401) },
  });
  app.patch('/:id', async (c) => {
    const body = AltBody.parse(await c.req.json());
    await ctn.media.setAlt(c.get('principal').orgId, c.req.param('id'), body.alt);
    return c.body(null, 204);
  });

  app.openAPIRegistry.registerPath({
    method: 'delete',
    path: '/{id}',
    tags: ['media'],
    security: AUTH_SECURITY,
    summary: 'Remove uma mídia (soft — arquivo fica p/ posts já agendados)',
    request: { params: IdParam },
    responses: { 204: { description: 'mídia removida' }, ...errorResponses(401) },
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
  const app = createApp();
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/{org}/{file}',
    tags: ['media'],
    summary: 'Serve um arquivo de mídia (público, sem auth — chaves UUID)',
    request: { params: z.object({ org: z.string(), file: z.string() }) },
    responses: {
      200: {
        description: 'bytes do arquivo',
        content: { 'application/octet-stream': { schema: z.string().openapi({ format: 'binary' }) } },
      },
      404: { description: 'não encontrado' },
    },
  });
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
