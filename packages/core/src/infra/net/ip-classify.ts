/**
 * Classificação normalizada de endereços para política anti-SSRF.
 * Rejeita loopback, privado, link-local, CGNAT, multicast, documentação e
 * formas ambíguas (IPv4-mapped de privado, zone id, etc.).
 */

export type AddressFamily = 'ipv4' | 'ipv6';

export type AddressClass =
  | 'public'
  | 'unspecified'
  | 'loopback'
  | 'private'
  | 'cgnat'
  | 'link_local'
  | 'multicast'
  | 'documentation'
  | 'reserved'
  | 'invalid';

export interface ClassifiedAddress {
  family: AddressFamily;
  /** Forma canônica textual (IPv4 dotted ou IPv6 sem zona). */
  address: string;
  classification: AddressClass;
}

const IPV4_OCTET = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** Parse IPv4; rejeita octal/leading zeros ambíguos e formas curtas. */
export function parseIpv4(raw: string): number | null {
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!IPV4_OCTET.test(p)) return null;
    // leading zero em dígito multiplo (08) é ambíguo em alguns parsers
    if (p.length > 1 && p.startsWith('0')) return null;
    octets.push(Number(p));
  }
  return ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
}

function classifyIpv4Int(n: number): AddressClass {
  const a = (n >>> 24) & 0xff;
  const b = (n >>> 16) & 0xff;
  if (n === 0) return 'unspecified';
  if (a === 0) return 'reserved';
  if (a === 127) return 'loopback';
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link_local';
  // CGNAT 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat';
  // documentation 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
  if (a === 192 && b === 0 && ((n >>> 8) & 0xff) === 2) return 'documentation';
  if (a === 198 && b === 51 && ((n >>> 8) & 0xff) === 100) return 'documentation';
  if (a === 203 && b === 0 && ((n >>> 8) & 0xff) === 113) return 'documentation';
  // multicast 224.0.0.0/4
  if (a >= 224 && a <= 239) return 'multicast';
  // reserved 240.0.0.0/4 and broadcast
  if (a >= 240) return 'reserved';
  // 192.0.0.0/24 (IETF protocol assignments) — treat as reserved except .0.9/.0.10 STUN which are rare; fail closed
  if (a === 192 && b === 0 && ((n >>> 8) & 0xff) === 0) return 'reserved';
  return 'public';
}

/** Expande IPv6 comprimido para 8 grupos de 16 bits. */
export function parseIpv6(raw: string): number[] | null {
  // zone id (fe80::1%eth0) — rejeitar
  if (raw.includes('%')) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('::') && lower.indexOf('::') !== lower.lastIndexOf('::')) return null;

  let head: string[];
  let tail: string[];
  if (lower.includes('::')) {
    const [h, t] = lower.split('::');
    head = h === '' ? [] : h.split(':');
    tail = t === '' ? [] : t.split(':');
  } else {
    head = lower.split(':');
    tail = [];
  }
  // IPv4-mapped no último grupo: :ffff:192.0.2.1
  const expand = (parts: string[]): number[] | null => {
    const out: number[] = [];
    for (const p of parts) {
      if (p.includes('.')) {
        const v4 = parseIpv4(p);
        if (v4 === null) return null;
        out.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
      out.push(parseInt(p, 16));
    }
    return out;
  };
  const h = expand(head);
  const t = expand(tail);
  if (!h || !t) return null;
  const missing = 8 - h.length - t.length;
  if (missing < 0) return null;
  if (!lower.includes('::') && missing !== 0) return null;
  if (lower.includes('::') && missing === 0 && head.length + tail.length !== 8) {
    // :: with exact 8 is ok only if one side empty representing zeros — already handled
  }
  const groups = [...h, ...Array(Math.max(missing, 0)).fill(0), ...t];
  if (groups.length !== 8) return null;
  return groups;
}

function classifyIpv6Groups(g: number[]): AddressClass {
  const isZero = g.every((x) => x === 0);
  if (isZero) return 'unspecified';
  // ::1
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0 && g[6] === 0 && g[7] === 1) {
    return 'loopback';
  }
  // IPv4-mapped ::ffff:x.x.x.x
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    const v4 = ((g[6]! << 16) | g[7]!) >>> 0;
    return classifyIpv4Int(v4);
  }
  // fe80::/10 link-local
  if ((g[0]! & 0xffc0) === 0xfe80) return 'link_local';
  // fc00::/7 unique local
  if ((g[0]! & 0xfe00) === 0xfc00) return 'private';
  // ff00::/8 multicast
  if ((g[0]! & 0xff00) === 0xff00) return 'multicast';
  // 2001:db8::/32 documentation
  if (g[0] === 0x2001 && g[1] === 0xdb8) return 'documentation';
  return 'public';
}

function formatIpv6(g: number[]): string {
  return g.map((x) => x.toString(16)).join(':');
}

/** Classifica um endereço literal (sem hostname). */
export function classifyAddress(raw: string): ClassifiedAddress {
  const input = raw.trim().toLowerCase();
  // strip brackets from [ipv6]
  const bare = input.startsWith('[') && input.endsWith(']') ? input.slice(1, -1) : input;

  if (bare.includes(':') && !bare.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    // could be ipv6
    const groups = parseIpv6(bare);
    if (!groups) {
      return { family: 'ipv6', address: bare, classification: 'invalid' };
    }
    return {
      family: 'ipv6',
      address: formatIpv6(groups),
      classification: classifyIpv6Groups(groups),
    };
  }

  const v4 = parseIpv4(bare);
  if (v4 === null) {
    return { family: 'ipv4', address: bare, classification: 'invalid' };
  }
  return {
    family: 'ipv4',
    address: `${(v4 >>> 24) & 0xff}.${(v4 >>> 16) & 0xff}.${(v4 >>> 8) & 0xff}.${v4 & 0xff}`,
    classification: classifyIpv4Int(v4),
  };
}

export function isForbiddenClassification(c: AddressClass): boolean {
  return c !== 'public';
}

/** True se o endereço é publicamente roteável para fins de SSRF. */
export function isPublicAddress(raw: string): boolean {
  return classifyAddress(raw).classification === 'public';
}
