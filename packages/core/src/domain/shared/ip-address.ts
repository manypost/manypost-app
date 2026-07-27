/**
 * Classificação de endereços IP para a política de saída (anti-SSRF — SPEC_API_MCP §3).
 *
 * Substitui o regex de prefixos textuais que existia antes. Prefixo em texto erra por
 * construção: `::ffff:127.0.0.1` (IPv4 mapeado), `2130706433` (decimal), `0177.0.0.1` (octal) e
 * `64:ff9b::7f00:1` (NAT64) apontam todos para 127.0.0.1 sem começar por "127.". Aqui o endereço
 * é **parseado** para bytes e comparado com faixas, e a forma ambígua é recusada antes de chegar
 * ao resolvedor do sistema — que interpretaria `2130706433` como um IP.
 *
 * Módulo puro: sem I/O, sem DNS, sem dependência. Quem resolve nome é a infra.
 */

export type ForbiddenReason =
  | 'unspecified'
  | 'loopback'
  | 'private'
  | 'cgnat'
  | 'link-local'
  | 'multicast'
  | 'documentation'
  | 'benchmarking'
  | 'protocol-assignment'
  | 'discard'
  | 'reserved'
  | 'zone-id'
  | 'malformed';

export type AddressVerdict =
  | { allowed: true; family: 4 | 6 }
  | { allowed: false; reason: ForbiddenReason };

const deny = (reason: ForbiddenReason): AddressVerdict => ({ allowed: false, reason });

// ---------------------------------------------------------------- parsing

/**
 * IPv4 em notação decimal pontilhada ESTRITA: quatro grupos, sem zero à esquerda.
 * `010.0.0.1` é recusado de propósito — em C `010` é octal (8), e é assim que um destino
 * ganha duas leituras diferentes entre a validação e o resolvedor.
 */
export function parseIPv4(text: string): Uint8Array | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const p = parts[i]!;
    if (!/^\d{1,3}$/.test(p)) return null;
    if (p.length > 1 && p[0] === '0') return null; // zero à esquerda = forma ambígua
    const n = Number(p);
    if (n > 255) return null;
    bytes[i] = n;
  }
  return bytes;
}

/** IPv6 canônico, com `::` e IPv4 embutido nos últimos 32 bits. Zone id (`%eth0`) é recusado. */
export function parseIPv6(text: string): Uint8Array | null {
  if (text.includes('%')) return null; // zone id: escopo local, sem sentido para saída
  if (text.includes(':::')) return null;

  let head = text;
  let tailV4: Uint8Array | null = null;
  const lastColon = head.lastIndexOf(':');
  if (lastColon >= 0 && head.slice(lastColon + 1).includes('.')) {
    tailV4 = parseIPv4(head.slice(lastColon + 1));
    if (!tailV4) return null;
    head = head.slice(0, lastColon + 1) + '0:0'; // dois grupos ocupados pelo IPv4
  }

  const doubleColon = head.indexOf('::');
  if (head.indexOf('::', doubleColon + 1) !== -1) return null; // só uma compressão

  const groupsOf = (s: string) => (s === '' ? [] : s.split(':'));
  let groups: string[];
  if (doubleColon === -1) {
    groups = groupsOf(head);
    if (groups.length !== 8) return null;
  } else {
    const left = groupsOf(head.slice(0, doubleColon));
    const right = groupsOf(head.slice(doubleColon + 2));
    if (left.length + right.length > 7) return null; // `::` vale por 1+ grupo
    groups = [...left, ...new Array(8 - left.length - right.length).fill('0'), ...right];
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const g = groups[i]!;
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    const n = Number.parseInt(g, 16);
    bytes[i * 2] = n >> 8;
    bytes[i * 2 + 1] = n & 0xff;
  }
  if (tailV4) bytes.set(tailV4, 12);
  return bytes;
}

const u32 = (b: Uint8Array) => ((b[0]! << 24) >>> 0) + (b[1]! << 16) + (b[2]! << 8) + b[3]!;
const inV4 = (addr: number, prefix: string, bits: number) => {
  const base = u32(parseIPv4(prefix)!);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (addr & mask) >>> 0 === (base & mask) >>> 0;
};

// ---------------------------------------------------------------- classificação

/** Faixas IPv4 que nunca são destino legítimo de saída (RFC 1918/5735/6598/6890). */
function classifyV4(bytes: Uint8Array): AddressVerdict {
  const a = u32(bytes);
  if (a === 0) return deny('unspecified');
  if (inV4(a, '0.0.0.0', 8)) return deny('reserved'); // "esta rede"
  if (inV4(a, '10.0.0.0', 8)) return deny('private');
  if (inV4(a, '100.64.0.0', 10)) return deny('cgnat');
  if (inV4(a, '127.0.0.0', 8)) return deny('loopback');
  if (inV4(a, '169.254.0.0', 16)) return deny('link-local'); // inclui o metadata de nuvem
  if (inV4(a, '172.16.0.0', 12)) return deny('private');
  if (inV4(a, '192.0.0.0', 24)) return deny('protocol-assignment');
  if (inV4(a, '192.0.2.0', 24)) return deny('documentation');
  if (inV4(a, '192.88.99.0', 24)) return deny('reserved'); // anycast 6to4, obsoleto
  if (inV4(a, '192.168.0.0', 16)) return deny('private');
  if (inV4(a, '198.18.0.0', 15)) return deny('benchmarking');
  if (inV4(a, '198.51.100.0', 24)) return deny('documentation');
  if (inV4(a, '203.0.113.0', 24)) return deny('documentation');
  if (inV4(a, '224.0.0.0', 4)) return deny('multicast');
  if (inV4(a, '240.0.0.0', 4)) return deny('reserved'); // inclui 255.255.255.255
  return { allowed: true, family: 4 };
}

const startsWith = (b: Uint8Array, prefix: number[]) => prefix.every((v, i) => b[i] === v);
/** compara os `bits` mais significativos com o prefixo dado em bytes */
const inV6 = (b: Uint8Array, prefix: number[], bits: number) => {
  const full = bits >> 3;
  for (let i = 0; i < full; i++) if (b[i] !== prefix[i]) return false;
  const rest = bits & 7;
  if (rest === 0) return true;
  const mask = (0xff << (8 - rest)) & 0xff;
  return (b[full]! & mask) === ((prefix[full] ?? 0) & mask);
};

function classifyV6(bytes: Uint8Array): AddressVerdict {
  const allZeroTop = bytes.slice(0, 10).every((v) => v === 0);

  // IPv4 mapeado (::ffff:a.b.c.d) e IPv4 compatível (::a.b.c.d, obsoleto): o que vale é o
  // endereço embutido — é por aqui que "::ffff:127.0.0.1" burlava o regex de prefixo textual
  if (allZeroTop && bytes[10] === 0xff && bytes[11] === 0xff) return classifyV4(bytes.slice(12));
  if (allZeroTop && bytes[10] === 0 && bytes[11] === 0) {
    const low = bytes.slice(12);
    if (u32(low) === 0) return deny('unspecified'); // ::
    if (u32(low) === 1) return deny('loopback'); // ::1
    return classifyV4(low); // IPv4 compatível
  }
  // NAT64 (64:ff9b::/96) e 6to4 (2002::/16) também carregam um IPv4 dentro
  if (inV6(bytes, [0x00, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0], 96)) {
    return classifyV4(bytes.slice(12));
  }
  if (startsWith(bytes, [0x20, 0x02])) return classifyV4(bytes.slice(2, 6));

  if (inV6(bytes, [0x01, 0x00], 8) && bytes.slice(1, 8).every((v) => v === 0)) return deny('discard');
  if (startsWith(bytes, [0x20, 0x01, 0x0d, 0xb8])) return deny('documentation');
  if (inV6(bytes, [0x3f, 0xff], 20)) return deny('documentation'); // RFC 9637
  if (inV6(bytes, [0x20, 0x01, 0x00, 0x20], 28)) return deny('reserved'); // ORCHIDv2
  if (inV6(bytes, [0x20, 0x01], 23)) return deny('protocol-assignment'); // inclui Teredo
  if (inV6(bytes, [0x5f, 0x00], 16)) return deny('reserved');
  if (inV6(bytes, [0xfc], 7)) return deny('private'); // ULA
  if (inV6(bytes, [0xfe, 0x80], 10)) return deny('link-local');
  if (inV6(bytes, [0xff], 8)) return deny('multicast');
  return { allowed: true, family: 6 };
}

/** Classifica um endereço IP literal já resolvido. Texto que não é IP válido = `malformed`. */
export function classifyAddress(text: string): AddressVerdict {
  const raw = text.trim();
  if (raw.includes('%')) return deny('zone-id');
  const v4 = parseIPv4(raw);
  if (v4) return classifyV4(v4);
  const v6 = parseIPv6(raw);
  if (v6) return classifyV6(v6);
  return deny('malformed');
}

/**
 * Nota sobre formas numéricas ambíguas (`2130706433`, `0x7f000001`, `127.1`, `0177.0.0.1`):
 * elas NÃO precisam de guarda própria aqui. O parser de URL do WHATWG já as canonicaliza para
 * a forma pontilhada antes de qualquer validação nossa — `new URL('http://2130706433/').hostname`
 * é `127.0.0.1` — e as inválidas (`999.999.999.999`, `1.2.3.4.5`) fazem o parser lançar. Ou seja,
 * quem chega em `classifyAddress` vindo de uma URL já vem canônico. Um guarda extra aqui pareceria
 * proteção sem proteger nada; a propriedade é garantida por teste em `pinned-fetch.test.ts`.
 */
