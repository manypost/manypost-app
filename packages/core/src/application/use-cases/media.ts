import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import { EXT_BY_MIME, sniffMedia } from '../../infra/media/sniff';
import type { MediaRecord, MediaRepository, MediaStorage } from '../ports/media';
import { assertPublicUrl } from './webhooks';

export interface MediaLimits {
  imageMaxBytes: number;
  videoMaxBytes: number;
}

export interface MediaDeps {
  media: MediaRepository;
  storage: MediaStorage;
  limits: MediaLimits;
}

const mb = (n: number) => Math.round(n / 1024 / 1024);

const assertWithinLimit = (kind: 'image' | 'video', size: number, limits: MediaLimits) => {
  const max = kind === 'image' ? limits.imageMaxBytes : limits.videoMaxBytes;
  if (size > max) {
    throw new DomainError(
      ErrorCodes.MediaTooLarge,
      `arquivo de ${mb(size)}MB excede o limite de ${mb(max)}MB para ${kind === 'image' ? 'imagens' : 'vídeos'}`,
    );
  }
};

async function storeSniffed(
  deps: MediaDeps,
  input: { orgId: string; bytes: Uint8Array; alt?: string },
): Promise<MediaRecord> {
  const sniffed = sniffMedia(input.bytes);
  if (!sniffed) {
    throw new DomainError(
      ErrorCodes.MediaUnsupportedType,
      'formato não suportado — use JPEG, PNG, GIF, WebP, MP4, MOV ou WebM',
    );
  }
  assertWithinLimit(sniffed.kind, input.bytes.byteLength, deps.limits);
  const key = `${input.orgId}/${crypto.randomUUID()}.${EXT_BY_MIME[sniffed.mime]}`;
  await deps.storage.put(key, input.bytes, sniffed.mime);
  return deps.media.create({
    orgId: input.orgId,
    path: key,
    mime: sniffed.mime,
    byteSize: input.bytes.byteLength,
    width: sniffed.width ?? null,
    height: sniffed.height ?? null,
    alt: input.alt?.trim() || null,
  });
}

export const makeUploadMedia = (deps: MediaDeps) =>
  (input: { orgId: string; bytes: Uint8Array; alt?: string }) => storeSniffed(deps, input);

export const makeIngestMediaFromUrl = (
  deps: MediaDeps & { allowPrivateUrls?: boolean; fetchFn?: typeof fetch },
) =>
  async (input: { orgId: string; url: string; alt?: string }): Promise<MediaRecord> => {
    const doFetch = deps.fetchFn ?? fetch;
    const maxBytes = Math.max(deps.limits.imageMaxBytes, deps.limits.videoMaxBytes);

    // segue redirects manualmente re-validando cada salto (um 302 podia apontar p/ rede privada)
    let url = input.url;
    let res: Response | undefined;
    for (let hop = 0; hop < 4; hop++) {
      await assertPublicUrl(url, deps.allowPrivateUrls, 'mídia');
      res = await doFetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': 'manypost-media' },
        signal: AbortSignal.timeout(30_000),
      }).catch((err) => {
        throw new DomainError(ErrorCodes.MediaFetchFailed, `download falhou: ${String(err).slice(0, 200)}`);
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) break;
        url = new URL(location, url).toString();
        continue;
      }
      break;
    }
    if (!res || !res.ok) {
      throw new DomainError(ErrorCodes.MediaFetchFailed, `download falhou (HTTP ${res?.status ?? '?'})`);
    }

    // lê com teto de tamanho — não confia no content-length
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new DomainError(ErrorCodes.MediaFetchFailed, 'resposta sem corpo');
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new DomainError(ErrorCodes.MediaTooLarge, `download excede o limite de ${mb(maxBytes)}MB`);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }

    return storeSniffed(deps, { orgId: input.orgId, bytes, ...(input.alt ? { alt: input.alt } : {}) });
  };

export const makeListMedia = (deps: Pick<MediaDeps, 'media'>) =>
  (orgId: string, opts?: { limit?: number }) => deps.media.list(orgId, opts);

export const makeSetMediaAlt = (deps: Pick<MediaDeps, 'media'>) =>
  async (orgId: string, id: string, alt: string | null) => {
    if (!(await deps.media.setAlt(orgId, id, alt))) {
      throw new DomainError(ErrorCodes.NotFound, 'mídia não encontrada');
    }
  };

/** Soft-delete: o arquivo permanece no storage — posts agendados ainda referenciam a URL. */
export const makeDeleteMedia = (deps: Pick<MediaDeps, 'media'>) =>
  async (orgId: string, id: string) => {
    if (!(await deps.media.softDelete(orgId, id))) {
      throw new DomainError(ErrorCodes.NotFound, 'mídia não encontrada');
    }
  };
