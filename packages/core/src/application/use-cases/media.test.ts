import { beforeEach, describe, expect, test } from 'bun:test';
import type { MediaRecord, MediaRepository, MediaStorage } from '../ports/media';
import { pngBytes } from '../../infra/media/sniff.fixtures';
import {
  makeDeleteMedia,
  makeIngestMediaFromUrl,
  makeListMedia,
  makeUploadMedia,
} from './media';

function makeFakes() {
  const files = new Map<string, Uint8Array>();
  const records: MediaRecord[] = [];
  let seq = 0;

  const storage: MediaStorage = {
    put: async (key, bytes) => void files.set(key, bytes),
    read: async (key) => files.get(key) ?? null,
    delete: async (key) => void files.delete(key),
    publicUrl: (key) => `https://mp.test/uploads/${key}`,
  };
  const media: MediaRepository = {
    create: async (d) => {
      const rec: MediaRecord = {
        id: `m-${++seq}`,
        durationSec: null,
        thumbnailPath: null,
        blurhash: null,
        createdAt: new Date(),
        ...d,
      };
      records.push(rec);
      return rec;
    },
    list: async (orgId) => records.filter((r) => r.orgId === orgId),
    findMany: async (orgId, ids) => records.filter((r) => r.orgId === orgId && ids.includes(r.id)),
    setAlt: async (orgId, id, alt) => {
      const r = records.find((x) => x.orgId === orgId && x.id === id);
      if (r) r.alt = alt;
      return !!r;
    },
    softDelete: async (orgId, id) => {
      const i = records.findIndex((x) => x.orgId === orgId && x.id === id);
      if (i >= 0) records.splice(i, 1);
      return i >= 0;
    },
  };
  const limits = { imageMaxBytes: 1024, videoMaxBytes: 4096 };
  return { files, records, storage, media, limits };
}

let f: ReturnType<typeof makeFakes>;
beforeEach(() => {
  f = makeFakes();
});

describe('uploadMedia', () => {
  test('detecta MIME real, extrai dimensões e grava no storage sob a org', async () => {
    const rec = await makeUploadMedia(f)({ orgId: 'org-1', bytes: pngBytes(64, 32), alt: ' logo ' });
    expect(rec.mime).toBe('image/png');
    expect(rec.width).toBe(64);
    expect(rec.height).toBe(32);
    expect(rec.alt).toBe('logo');
    expect(rec.path).toStartWith('org-1/');
    expect(rec.path).toEndWith('.png');
    expect(f.files.get(rec.path)).toEqual(pngBytes(64, 32));
  });

  test('content-type do cliente é irrelevante: bytes não-suportados são recusados', async () => {
    await expect(
      makeUploadMedia(f)({ orgId: 'org-1', bytes: new TextEncoder().encode('#!/bin/sh\nrm -rf /') }),
    ).rejects.toMatchObject({ code: 'media.unsupported_type' });
  });

  test('acima do limite por tipo → media.too_large e nada é gravado', async () => {
    const big = new Uint8Array(2048);
    big.set(pngBytes());
    await expect(makeUploadMedia(f)({ orgId: 'org-1', bytes: big })).rejects.toMatchObject({
      code: 'media.too_large',
    });
    expect(f.files.size).toBe(0);
  });
});

describe('ingestMediaFromUrl (anti-SSRF)', () => {
  const fetchPng = (async () => new Response(pngBytes(10, 10))) as unknown as typeof fetch;

  test('URL para rede privada é bloqueada por padrão', async () => {
    await expect(
      makeIngestMediaFromUrl({ ...f, fetchFn: fetchPng })({
        orgId: 'org-1',
        url: 'http://127.0.0.1/interno.png',
      }),
    ).rejects.toMatchObject({ code: 'post.invalid_settings' });
  });

  test('baixa, sniffa e armazena (dev: allowPrivateUrls)', async () => {
    const rec = await makeIngestMediaFromUrl({ ...f, allowPrivateUrls: true, fetchFn: fetchPng })({
      orgId: 'org-1',
      url: 'http://127.0.0.1:9/a.png',
    });
    expect(rec.mime).toBe('image/png');
    expect(f.files.get(rec.path)).toBeDefined();
  });

  test('segue redirect re-validando cada salto', async () => {
    const seen: string[] = [];
    const fetchFn = (async (url: any) => {
      seen.push(String(url));
      if (seen.length === 1) {
        return new Response(null, { status: 302, headers: { location: '/final.png' } });
      }
      return new Response(pngBytes(10, 10));
    }) as unknown as typeof fetch;
    const rec = await makeIngestMediaFromUrl({ ...f, allowPrivateUrls: true, fetchFn })({
      orgId: 'org-1',
      url: 'http://127.0.0.1:9/inicio',
    });
    expect(seen).toEqual(['http://127.0.0.1:9/inicio', 'http://127.0.0.1:9/final.png']);
    expect(rec.mime).toBe('image/png');
  });

  test('corpo maior que o teto aborta com media.too_large (ignora content-length)', async () => {
    const fetchFn = (async () =>
      new Response(new Uint8Array(8192), { headers: { 'content-length': '10' } })) as unknown as typeof fetch;
    await expect(
      makeIngestMediaFromUrl({ ...f, allowPrivateUrls: true, fetchFn })({
        orgId: 'org-1',
        url: 'http://127.0.0.1:9/gigante.png',
      }),
    ).rejects.toMatchObject({ code: 'media.too_large' });
  });

  test('HTTP de erro → media.fetch_failed', async () => {
    const fetchFn = (async () => new Response('nope', { status: 403 })) as unknown as typeof fetch;
    await expect(
      makeIngestMediaFromUrl({ ...f, allowPrivateUrls: true, fetchFn })({
        orgId: 'org-1',
        url: 'http://127.0.0.1:9/x.png',
      }),
    ).rejects.toMatchObject({ code: 'media.fetch_failed' });
  });
});

describe('listar/apagar', () => {
  test('lista por org; delete de outra org → not_found', async () => {
    const rec = await makeUploadMedia(f)({ orgId: 'org-1', bytes: pngBytes() });
    expect(await makeListMedia(f)('org-1')).toHaveLength(1);
    expect(await makeListMedia(f)('org-2')).toHaveLength(0);
    await expect(makeDeleteMedia(f)('org-2', rec.id)).rejects.toMatchObject({
      code: 'common.not_found',
    });
    await makeDeleteMedia(f)('org-1', rec.id);
    expect(await makeListMedia(f)('org-1')).toHaveLength(0);
  });
});
