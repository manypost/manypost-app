/**
 * Geometria do vídeo lida do container ISO BMFF (mp4/mov), sem dependência — mesma abordagem do
 * `sniff.ts` do core para imagem: os headers são estáveis há décadas e a leitura é limitada a um
 * prefixo do arquivo.
 *
 * Existe porque o YouTube **não tem parâmetro de Short na API**: ele classifica o upload pela
 * proporção e pela duração do próprio arquivo. Sem medir, um "publicar como Short" seria um botão
 * que não faz nada. Ver `openspec/changes/add-youtube-provider/design.md`.
 */

/** Teto de duração de um Short no YouTube. Já subiu de 60s para 180s uma vez — por isso é constante. */
export const SHORTS_MAX_DURATION_SEC = 180;

export interface VideoGeometry {
  /** largura de exibição, já com a rotação do tkhd aplicada */
  width: number;
  /** altura de exibição, já com a rotação do tkhd aplicada */
  height: number;
  durationSec: number;
}

/** O YouTube trata vertical e quadrado como Short; só o horizontal está fora. */
export function isVerticalEnoughForShorts(g: VideoGeometry): boolean {
  return g.height >= g.width;
}

const typeAt = (b: Uint8Array, o: number) =>
  String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);

interface Box {
  type: string;
  /** início do conteúdo (depois de size+type e do largesize, quando houver) */
  start: number;
  /** fim do conteúdo, já limitado ao tamanho do buffer */
  end: number;
  /** próximo offset a visitar no nível atual */
  next: number;
}

/**
 * Lê uma caixa em `off`. Devolve undefined quando não há cabeçalho completo ou o tamanho é
 * incoerente — é assim que bytes que não são ISO BMFF são rejeitados sem lançar.
 */
function readBox(b: Uint8Array, off: number, limit: number): Box | undefined {
  if (off + 8 > limit) return undefined;
  const dv = new DataView(b.buffer, b.byteOffset);
  let size = dv.getUint32(off);
  const type = typeAt(b, off + 4);
  // o tipo é sempre ASCII imprimível; qualquer outra coisa não é uma caixa
  if (!/^[\x20-\x7e]{4}$/.test(type)) return undefined;
  let start = off + 8;
  if (size === 1) {
    // largesize de 64 bits logo após o tipo
    if (off + 16 > limit) return undefined;
    const large = dv.getBigUint64(off + 8);
    if (large > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
    size = Number(large);
    start = off + 16;
  } else if (size === 0) {
    // "até o fim do arquivo"
    size = limit - off;
  }
  if (size < start - off) return undefined;
  // o prefixo pode cortar a caixa no meio: seguimos com o que temos (é o caso do moov grande)
  const end = Math.min(off + size, limit);
  return { type, start, end, next: off + size };
}

/** Percorre as caixas de um nível, parando no primeiro erro de leitura. */
function* walk(b: Uint8Array, from: number, to: number): Generator<Box> {
  let off = from;
  while (off < to) {
    const box = readBox(b, off, to);
    if (!box) return;
    yield box;
    if (box.next <= off) return; // tamanho degenerado — não avançaria
    off = box.next;
  }
}

function findBox(b: Uint8Array, from: number, to: number, type: string): Box | undefined {
  for (const box of walk(b, from, to)) if (box.type === type) return box;
  return undefined;
}

/** mvhd: timescale + duration. A versão 1 guarda os tempos em 64 bits — offsets diferentes. */
function readDuration(b: Uint8Array, mvhd: Box): number | undefined {
  const dv = new DataView(b.buffer, b.byteOffset);
  const version = b[mvhd.start];
  if (version !== 0 && version !== 1) return undefined;
  // version+flags (4) + creation + modification
  const tsAt = mvhd.start + 4 + (version === 1 ? 16 : 8);
  const durAt = tsAt + 4;
  const needs = version === 1 ? 8 : 4;
  if (durAt + needs > mvhd.end) return undefined;
  const timescale = dv.getUint32(tsAt);
  if (!timescale) return undefined;
  const duration = version === 1 ? Number(dv.getBigUint64(durAt)) : dv.getUint32(durAt);
  return duration / timescale;
}

/**
 * tkhd: dimensões de exibição em 16.16 e a matriz de transformação. Um vídeo de celular costuma
 * ser gravado em paisagem com rotação de 90° na matriz — ler só width/height classificaria um
 * Short legítimo como horizontal.
 */
function readTrack(b: Uint8Array, tkhd: Box): { width: number; height: number } | undefined {
  const dv = new DataView(b.buffer, b.byteOffset);
  const version = b[tkhd.start];
  if (version !== 0 && version !== 1) return undefined;
  // version+flags (4) + [creation, modification, track_id, reserved, duration] + 16 reservados
  const preMatrix = tkhd.start + 4 + (version === 1 ? 32 : 20) + 16;
  const widthAt = preMatrix + 36;
  if (widthAt + 8 > tkhd.end) return undefined;

  const width = dv.getUint32(widthAt) / 65536;
  const height = dv.getUint32(widthAt + 4) / 65536;
  if (!width || !height) return undefined; // faixa sem vídeo (áudio, legenda)

  // matriz (a,b,u,c,d,v,x,y,w): rotação de 90°/270° zera a e d e preenche b e c
  const a = dv.getUint32(preMatrix);
  const d = dv.getUint32(preMatrix + 16);
  const b16 = dv.getUint32(preMatrix + 4);
  const c = dv.getUint32(preMatrix + 12);
  const rotated = a === 0 && d === 0 && b16 !== 0 && c !== 0;

  return rotated ? { width: height, height: width } : { width, height };
}

/**
 * Extrai a geometria do prefixo de um arquivo mp4/mov. Devolve `undefined` quando o container não
 * é ISO BMFF (webm), quando o `moov` está no fim do arquivo e ficou fora do prefixo, ou quando os
 * campos não puderam ser lidos. O chamador decide o que fazer com a ausência — no provider do
 * YouTube, ela só é fatal quando a pessoa declarou explicitamente que quer (ou não quer) um Short.
 */
export function parseVideoGeometry(head: Uint8Array): VideoGeometry | undefined {
  if (head.length < 8) return undefined;

  const moov = findBox(head, 0, head.length, 'moov');
  if (!moov) return undefined;

  const mvhd = findBox(head, moov.start, moov.end, 'mvhd');
  const durationSec = mvhd ? readDuration(head, mvhd) : undefined;
  if (durationSec === undefined) return undefined;

  for (const trak of walk(head, moov.start, moov.end)) {
    if (trak.type !== 'trak') continue;
    const tkhd = findBox(head, trak.start, trak.end, 'tkhd');
    const dims = tkhd ? readTrack(head, tkhd) : undefined;
    if (dims) return { ...dims, durationSec };
  }
  return undefined;
}
