/** Ports de mídia (SPEC_DATA §3, SPEC_API_MCP §3) — biblioteca de uploads da org. */

export interface MediaRecord {
  id: string;
  orgId: string;
  /** chave no storage: `<orgId>/<uuid>.<ext>` */
  path: string;
  mime: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  thumbnailPath: string | null;
  alt: string | null;
  blurhash: string | null;
  /** `upload` | `ai` — a biblioteca marca o que é sintético (SPEC ai-image-generation) */
  source: 'upload' | 'ai';
  /** prompt que gerou, quando `source === 'ai'` */
  generationPrompt: string | null;
  /** modelo que produziu, quando `source === 'ai'` */
  generationModel: string | null;
  createdAt: Date;
}

export interface MediaRepository {
  create(
    d: Omit<
      MediaRecord,
      | 'id'
      | 'createdAt'
      | 'durationSec'
      | 'thumbnailPath'
      | 'blurhash'
      | 'source'
      | 'generationPrompt'
      | 'generationModel'
    > &
      Partial<Pick<MediaRecord, 'source' | 'generationPrompt' | 'generationModel'>>,
  ): Promise<MediaRecord>;
  list(orgId: string, opts?: { limit?: number }): Promise<MediaRecord[]>;
  findMany(orgId: string, ids: string[]): Promise<MediaRecord[]>;
  setAlt(orgId: string, id: string, alt: string | null): Promise<boolean>;
  softDelete(orgId: string, id: string): Promise<boolean>;
}

/** Storage de arquivos (local no self-host; S3/R2 na onda 2 — IG exige URL pública). */
export interface MediaStorage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  read(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /** URL estável que o worker e as redes conseguem baixar (PUBLIC_URL/uploads/...) */
  publicUrl(key: string): string;
}
