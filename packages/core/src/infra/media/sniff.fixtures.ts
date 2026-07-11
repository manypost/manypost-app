/** Fixtures mínimas de arquivos de mídia p/ testes: só os headers que o sniffer lê. */

export function pngBytes(width = 800, height = 600): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

export function jpegBytes(width = 480, height = 270): Uint8Array {
  // SOI + APP0 (16 bytes de payload) + SOF0 com as dimensões
  const b = new Uint8Array(2 + 18 + 9);
  b.set([0xff, 0xd8]); // SOI
  b.set([0xff, 0xe0, 0x00, 0x10], 2); // APP0, len=16 (inclui os 2 bytes do próprio len)
  const sof = 2 + 18;
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08], sof);
  new DataView(b.buffer).setUint16(sof + 5, height);
  new DataView(b.buffer).setUint16(sof + 7, width);
  return b;
}

export function gifBytes(width = 320, height = 240): Uint8Array {
  const b = new Uint8Array(13);
  b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  new DataView(b.buffer).setUint16(6, width, true);
  new DataView(b.buffer).setUint16(8, height, true);
  return b;
}

export function webpVp8xBytes(width = 1024, height = 768): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46]); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  b.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  const w = width - 1;
  const h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  b.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return b;
}

export function mp4Bytes(): Uint8Array {
  const b = new Uint8Array(16);
  b.set([0, 0, 0, 0x10]);
  b.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
  b.set([0x69, 0x73, 0x6f, 0x6d], 8); // isom
  return b;
}
