import { describe, expect, test } from 'bun:test';
import {
  parseVideoGeometry,
  isVerticalEnoughForShorts,
  SHORTS_MAX_DURATION_SEC,
} from './mp4-geometry';

// Fixtures do container ISO BMFF (mp4/mov). Montamos as caixas na mao, como o sniff.ts do core faz
// com os headers de imagem: o formato e estavel ha decadas e uma fixture binaria opaca nao
// documentaria nada. Cada helper monta exatamente os campos que o parser le.

const ascii = (s: string) => new TextEncoder().encode(s);

function box(type: string, payload: Uint8Array): Uint8Array {
  const b = new Uint8Array(8 + payload.length);
  new DataView(b.buffer).setUint32(0, b.length);
  b.set(ascii(type), 4);
  b.set(payload, 8);
  return b;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** matriz de transformacao do tkhd: 9 valores 32-bit (a,b,u,c,d,v,x,y,w). */
function matrix(rotation: 0 | 90 | 180 | 270): Uint8Array {
  const m = new Uint8Array(36);
  const dv = new DataView(m.buffer);
  const ONE = 0x00010000; // 1.0 em 16.16
  const NEG = 0xffff0000; // -1.0 em 16.16
  const W = 0x40000000; // 1.0 em 2.30
  if (rotation === 0) {
    dv.setUint32(0, ONE); // a
    dv.setUint32(16, ONE); // d
  } else if (rotation === 90) {
    dv.setUint32(4, ONE); // b
    dv.setUint32(12, NEG); // c
  } else if (rotation === 180) {
    dv.setUint32(0, NEG);
    dv.setUint32(16, NEG);
  } else {
    dv.setUint32(4, NEG); // b
    dv.setUint32(12, ONE); // c
  }
  dv.setUint32(32, W);
  return m;
}

function mvhd(opts: { version: 0 | 1; timescale: number; duration: number }): Uint8Array {
  const isV1 = opts.version === 1;
  // version+flags, [creation, modification], timescale, duration, + cauda que o parser ignora
  const head = new Uint8Array(4 + (isV1 ? 16 : 8) + 4 + (isV1 ? 8 : 4));
  const dv = new DataView(head.buffer);
  dv.setUint8(0, opts.version);
  const tsAt = 4 + (isV1 ? 16 : 8);
  dv.setUint32(tsAt, opts.timescale);
  if (isV1) dv.setBigUint64(tsAt + 4, BigInt(opts.duration));
  else dv.setUint32(tsAt + 4, opts.duration);
  // cauda real do mvhd (rate, volume, reservados, matriz, predefinidos, next_track_id)
  return box('mvhd', concat(head, new Uint8Array(80)));
}

function tkhd(opts: {
  version: 0 | 1;
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
}): Uint8Array {
  const isV1 = opts.version === 1;
  const preMatrix = 4 + (isV1 ? 32 : 20) + 16;
  const payload = new Uint8Array(preMatrix + 36 + 8);
  const dv = new DataView(payload.buffer);
  dv.setUint8(0, opts.version);
  payload.set(matrix(opts.rotation ?? 0), preMatrix);
  dv.setUint32(preMatrix + 36, Math.round(opts.width * 65536)); // 16.16
  dv.setUint32(preMatrix + 40, Math.round(opts.height * 65536));
  return box('tkhd', payload);
}

/** arquivo completo: ftyp + moov(mvhd + trak(tkhd) [+ cauda]) — a forma de um export faststart. */
function mp4(opts: {
  version?: 0 | 1;
  width: number;
  height: number;
  durationSec: number;
  timescale?: number;
  rotation?: 0 | 90 | 180 | 270;
  extraTrackFirst?: boolean;
  /** cauda volumosa dentro do moov (tabelas de indice), depois das caixas que o parser le */
  moovTailBytes?: number;
}): Uint8Array {
  const version = opts.version ?? 0;
  const timescale = opts.timescale ?? 1000;
  const traks = [
    box('trak', tkhd({ version, width: opts.width, height: opts.height, rotation: opts.rotation ?? 0 })),
  ];
  if (opts.extraTrackFirst) {
    // faixa de audio: tkhd com width/height zerados, vem antes da faixa de video
    traks.unshift(box('trak', tkhd({ version, width: 0, height: 0 })));
  }
  const tail = opts.moovTailBytes ? [box('free', new Uint8Array(opts.moovTailBytes))] : [];
  return concat(
    box('ftyp', ascii('isom   isomiso2avc1mp41')),
    box(
      'moov',
      concat(
        mvhd({ version, timescale, duration: Math.round(opts.durationSec * timescale) }),
        ...traks,
        ...tail,
      ),
    ),
  );
}

describe('parseVideoGeometry: leitura do container', () => {
  test('mvhd versao 0 (duracao 32-bit) devolve dimensao e duracao', () => {
    const g = parseVideoGeometry(mp4({ width: 1920, height: 1080, durationSec: 42 }));
    expect(g).toEqual({ width: 1920, height: 1080, durationSec: 42 });
  });

  test('mvhd versao 1 (duracao 64-bit) e lido com os offsets certos', () => {
    // com offsets de versao 0 a duracao sairia por ordens de grandeza — e o bug que este teste trava
    const g = parseVideoGeometry(mp4({ version: 1, width: 1080, height: 1920, durationSec: 95 }));
    expect(g).toEqual({ width: 1080, height: 1920, durationSec: 95 });
  });

  test('timescale diferente de 1000 e respeitado', () => {
    const g = parseVideoGeometry(
      mp4({ width: 640, height: 480, durationSec: 12, timescale: 90_000 }),
    );
    expect(g?.durationSec).toBe(12);
  });

  test('video 1920x1080 gravado com rotacao de 90 graus e vertical', () => {
    // o caso do celular: o arquivo guarda paisagem + matriz de rotacao. Ler so o tkhd cru
    // classificaria como horizontal e recusaria um Short legitimo.
    const g = parseVideoGeometry(mp4({ width: 1920, height: 1080, durationSec: 30, rotation: 90 }));
    expect(g).toEqual({ width: 1080, height: 1920, durationSec: 30 });
  });

  test('rotacao de 270 graus tambem troca os eixos', () => {
    const g = parseVideoGeometry(mp4({ width: 1920, height: 1080, durationSec: 10, rotation: 270 }));
    expect(g?.width).toBe(1080);
    expect(g?.height).toBe(1920);
  });

  test('rotacao de 180 graus preserva os eixos', () => {
    const g = parseVideoGeometry(mp4({ width: 1920, height: 1080, durationSec: 10, rotation: 180 }));
    expect(g?.width).toBe(1920);
    expect(g?.height).toBe(1080);
  });

  test('faixa de audio (tkhd zerado) nao e confundida com a faixa de video', () => {
    const g = parseVideoGeometry(
      mp4({ width: 1080, height: 1920, durationSec: 20, extraTrackFirst: true }),
    );
    expect(g).toEqual({ width: 1080, height: 1920, durationSec: 20 });
  });

  test('prefixo truncado sem moov devolve undefined em vez de lancar', () => {
    const full = mp4({ width: 1080, height: 1920, durationSec: 20 });
    expect(parseVideoGeometry(full.slice(0, 16))).toBeUndefined();
  });

  test('moov cortado depois do tkhd ainda entrega a geometria', () => {
    // moov grande (tabelas de indice) cortado pelo prefixo: mvhd e tkhd ficam no comeco e sao
    // suficientes. E a garantia que o design assume ao ler so um prefixo do arquivo.
    const full = mp4({ width: 1080, height: 1920, durationSec: 20, moovTailBytes: 4096 });
    const g = parseVideoGeometry(full.slice(0, full.length - 3000));
    expect(g).toEqual({ width: 1080, height: 1920, durationSec: 20 });
  });

  test('tkhd cortado ao meio devolve undefined em vez de dimensao errada', () => {
    const full = mp4({ width: 1080, height: 1920, durationSec: 20 });
    expect(parseVideoGeometry(full.slice(0, full.length - 4))).toBeUndefined();
  });

  test('bytes que nao sao container ISO BMFF devolvem undefined', () => {
    expect(parseVideoGeometry(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8]))).toBeUndefined();
    expect(parseVideoGeometry(new Uint8Array(0))).toBeUndefined();
  });

  test('caixa com tamanho declarado zero (ate o fim do arquivo) e aceita', () => {
    const full = mp4({ width: 720, height: 1280, durationSec: 8 });
    const ftypLen = new DataView(full.buffer, full.byteOffset).getUint32(0);
    const patched = new Uint8Array(full);
    new DataView(patched.buffer).setUint32(ftypLen, 0);
    expect(parseVideoGeometry(patched)?.height).toBe(1280);
  });
});

describe('regras de Short derivadas da geometria', () => {
  test('vertical e quadrado passam; horizontal nao', () => {
    expect(isVerticalEnoughForShorts({ width: 1080, height: 1920, durationSec: 10 })).toBe(true);
    expect(isVerticalEnoughForShorts({ width: 1080, height: 1080, durationSec: 10 })).toBe(true);
    expect(isVerticalEnoughForShorts({ width: 1920, height: 1080, durationSec: 10 })).toBe(false);
  });

  test('o teto de duracao do Short e o do YouTube (3 minutos)', () => {
    expect(SHORTS_MAX_DURATION_SEC).toBe(180);
  });
});
