/**
 * Detecção de MIME real por magic bytes + dimensões de imagem (SPEC_API_MCP §3:
 * "MIME real por magic bytes" — o content-type do cliente nunca é confiável).
 * Sem dependências: os headers dos formatos suportados são estáveis há décadas.
 */

export interface SniffedMedia {
  mime: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
}

export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime]),
);

const be16 = (b: Uint8Array, o: number) => ((b[o]! << 8) | b[o + 1]!) >>> 0;
const le16 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8)) >>> 0;
const be32 = (b: Uint8Array, o: number) =>
  ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
const le24 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16)) >>> 0;
const ascii = (b: Uint8Array, o: number, len: number) =>
  String.fromCharCode(...b.subarray(o, o + len));

function jpegDimensions(b: Uint8Array): { width: number; height: number } | undefined {
  // varre segmentos até um SOF (C0..CF, exceto C4/C8/CC que não carregam dimensões);
  // o SOF é lido até o byte i+8 (width em be16 no offset i+7)
  let i = 2;
  while (i + 8 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: be16(b, i + 5), width: be16(b, i + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2; // marcadores sem payload
      continue;
    }
    i += 2 + be16(b, i + 2);
  }
  return undefined;
}

function webpDimensions(b: Uint8Array): { width: number; height: number } | undefined {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X' && b.length >= 30) {
    return { width: 1 + le24(b, 24), height: 1 + le24(b, 27) };
  }
  if (chunk === 'VP8 ' && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    const width = 1 + (((b[22]! & 0x3f) << 8) | b[21]!);
    const height = 1 + (((b[24]! & 0x0f) << 10) | (b[23]! << 2) | ((b[22]! & 0xc0) >> 6));
    return { width, height };
  }
  return undefined;
}

/** Retorna null quando o formato não é um dos suportados (JPEG/PNG/GIF/WebP/MP4/MOV/WebM). */
export function sniffMedia(b: Uint8Array): SniffedMedia | null {
  if (b.length < 12) return null;

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: 'image/jpeg', kind: 'image', ...jpegDimensions(b) };
  }
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b.length >= 24) {
    return { mime: 'image/png', kind: 'image', width: be32(b, 16), height: be32(b, 20) };
  }
  if (ascii(b, 0, 4) === 'GIF8') {
    return { mime: 'image/gif', kind: 'image', width: le16(b, 6), height: le16(b, 8) };
  }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    return { mime: 'image/webp', kind: 'image', ...webpDimensions(b) };
  }
  if (ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    return brand.startsWith('qt')
      ? { mime: 'video/quicktime', kind: 'video' }
      : { mime: 'video/mp4', kind: 'video' };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return { mime: 'video/webm', kind: 'video' };
  }
  return null;
}
