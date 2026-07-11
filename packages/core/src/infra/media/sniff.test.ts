import { describe, expect, test } from 'bun:test';
import { gifBytes, jpegBytes, mp4Bytes, pngBytes, webpVp8xBytes } from './sniff.fixtures';
import { sniffMedia } from './sniff';

describe('sniffMedia (MIME real por magic bytes)', () => {
  test('PNG com dimensões', () => {
    expect(sniffMedia(pngBytes(800, 600))).toEqual({
      mime: 'image/png',
      kind: 'image',
      width: 800,
      height: 600,
    });
  });

  test('JPEG com dimensões via segmento SOF', () => {
    expect(sniffMedia(jpegBytes(480, 270))).toEqual({
      mime: 'image/jpeg',
      kind: 'image',
      width: 480,
      height: 270,
    });
  });

  test('GIF com dimensões little-endian', () => {
    expect(sniffMedia(gifBytes(320, 240))).toMatchObject({
      mime: 'image/gif',
      width: 320,
      height: 240,
    });
  });

  test('WebP VP8X com canvas estendido', () => {
    expect(sniffMedia(webpVp8xBytes(1024, 768))).toMatchObject({
      mime: 'image/webp',
      width: 1024,
      height: 768,
    });
  });

  test('MP4 (ftyp) e WebM (EBML) como vídeo, MOV via brand qt', () => {
    expect(sniffMedia(mp4Bytes())).toMatchObject({ mime: 'video/mp4', kind: 'video' });
    const webm = new Uint8Array(12);
    webm.set([0x1a, 0x45, 0xdf, 0xa3]);
    expect(sniffMedia(webm)).toMatchObject({ mime: 'video/webm', kind: 'video' });
    const mov = mp4Bytes();
    mov.set([0x71, 0x74, 0x20, 0x20], 8); // brand 'qt  '
    expect(sniffMedia(mov)).toMatchObject({ mime: 'video/quicktime' });
  });

  test('formato desconhecido (texto, SVG, buffer curto) → null', () => {
    expect(sniffMedia(new TextEncoder().encode('olá mundo, não sou uma imagem'))).toBeNull();
    expect(sniffMedia(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffMedia(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});
