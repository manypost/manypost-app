import { describe, expect, test } from 'bun:test';
import { classifyAddress, parseIPv4, parseIPv6, type ForbiddenReason } from './ip-address';

/**
 * Tabela de referência da política de saída. Cada linha existe porque é uma forma real de
 * apontar para dentro da infraestrutura: o regex anterior (`^(10\.|127\.|…)`) aceitava a
 * maioria delas, porque comparava PREFIXO DE TEXTO em vez de classificar o endereço.
 */
const FORBIDDEN: Array<[string, ForbiddenReason, string]> = [
  // --- IPv4 clássicos
  ['0.0.0.0', 'unspecified', 'endereço nulo: no Linux conecta em localhost'],
  ['10.1.2.3', 'private', 'RFC 1918'],
  ['172.16.0.1', 'private', 'RFC 1918 início da faixa'],
  ['172.31.255.254', 'private', 'RFC 1918 fim da faixa'],
  ['192.168.1.1', 'private', 'RFC 1918'],
  ['127.0.0.1', 'loopback', 'o próprio host'],
  ['127.255.255.254', 'loopback', 'a /8 inteira é loopback, não só 127.0.0.1'],
  ['169.254.169.254', 'link-local', 'metadata de nuvem — o alvo clássico de SSRF'],
  ['100.64.0.1', 'cgnat', 'CGNAT: rede do provedor, não é pública'],
  ['192.0.0.1', 'protocol-assignment', ''],
  ['192.0.2.5', 'documentation', ''],
  ['198.51.100.5', 'documentation', ''],
  ['203.0.113.5', 'documentation', ''],
  ['198.19.0.1', 'benchmarking', ''],
  ['224.0.0.1', 'multicast', ''],
  ['255.255.255.255', 'reserved', 'broadcast'],
  ['240.0.0.1', 'reserved', ''],
  // --- IPv6 que o regex textual não pegava
  ['::', 'unspecified', ''],
  ['::1', 'loopback', ''],
  ['fc00::1', 'private', 'ULA'],
  ['fd12:3456::1', 'private', 'ULA — a forma que aparece na prática'],
  ['fe80::1', 'link-local', ''],
  ['ff02::1', 'multicast', ''],
  ['2001:db8::1', 'documentation', ''],
  ['3fff::1', 'documentation', 'RFC 9637'],
  ['100::1', 'discard', ''],
  ['2001::1', 'protocol-assignment', 'Teredo'],
  ['2001:20::1', 'reserved', 'ORCHIDv2'],
  // --- as travessias: um endereço privado escondido dentro de um IPv6
  ['::ffff:127.0.0.1', 'loopback', 'IPv4 mapeado: não começa por "127."'],
  ['::ffff:169.254.169.254', 'link-local', 'metadata de nuvem via IPv4 mapeado'],
  ['::ffff:10.0.0.1', 'private', ''],
  ['::127.0.0.1', 'loopback', 'IPv4 compatível (obsoleto, ainda roteável no stack)'],
  ['64:ff9b::7f00:1', 'loopback', 'NAT64 com 127.0.0.1 embutido'],
  ['64:ff9b::a9fe:a9fe', 'link-local', 'NAT64 com o metadata embutido'],
  ['2002:7f00:1::1', 'loopback', '6to4 com 127.0.0.1 embutido'],
  ['2002:a9fe:a9fe::1', 'link-local', '6to4 com o metadata embutido'],
  // --- formas ambíguas: parecem IP, não são IP estrito
  ['010.0.0.1', 'malformed', 'zero à esquerda = octal em C'],
  ['127.1', 'malformed', 'forma curta que o resolvedor expande'],
  ['0x7f.0.0.1', 'malformed', 'hexadecimal'],
  ['fe80::1%eth0', 'zone-id', 'zone id: escopo local'],
];

const ALLOWED = [
  '1.1.1.1',
  '8.8.8.8',
  '104.20.23.154',
  '172.15.0.1', // logo ANTES da faixa privada
  '172.32.0.1', // logo DEPOIS da faixa privada
  '100.63.255.255', // logo antes do CGNAT
  '100.128.0.1', // logo depois do CGNAT
  '169.253.0.1',
  '2606:4700::1111',
  '2a00:1450:4001:80f::200e',
  '::ffff:8.8.8.8', // IPv4 mapeado público continua público
  '2002:0808:0808::1', // 6to4 com IPv4 público embutido
];

describe('classificação de endereço (política de saída)', () => {
  for (const [address, reason, why] of FORBIDDEN) {
    test(`recusa ${address}${why ? ` — ${why}` : ''}`, () => {
      const verdict = classifyAddress(address);
      expect(verdict.allowed).toBe(false);
      expect(verdict.allowed === false && verdict.reason).toBe(reason);
    });
  }

  for (const address of ALLOWED) {
    test(`aceita ${address}`, () => {
      expect(classifyAddress(address).allowed).toBe(true);
    });
  }

  test('texto que não é endereço nenhum é malformado, nunca permitido', () => {
    for (const junk of ['', 'example.com', '1.2.3.4.5', '256.1.1.1', 'gggg::1', '::ffff:999.1.1.1']) {
      const verdict = classifyAddress(junk);
      expect(verdict.allowed).toBe(false);
    }
  });
});

describe('parsing estrito', () => {
  test('IPv4 recusa zero à esquerda, grupo fora de faixa e contagem errada', () => {
    expect(parseIPv4('192.168.0.1')).not.toBeNull();
    expect(parseIPv4('0.0.0.0')).not.toBeNull();
    expect(parseIPv4('01.2.3.4')).toBeNull();
    expect(parseIPv4('1.2.3.256')).toBeNull();
    expect(parseIPv4('1.2.3')).toBeNull();
    expect(parseIPv4('1.2.3.4.5')).toBeNull();
    expect(parseIPv4(' 1.2.3.4')).toBeNull();
  });

  test('IPv6 aceita compressão e IPv4 embutido; recusa compressão dupla e grupo inválido', () => {
    expect(parseIPv6('::1')).not.toBeNull();
    expect(parseIPv6('2001:db8::1')).not.toBeNull();
    expect(parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).not.toBeNull();
    expect(parseIPv6('::ffff:1.2.3.4')).not.toBeNull();
    expect(parseIPv6('1::2::3')).toBeNull();
    expect(parseIPv6('2001:db8:::1')).toBeNull();
    expect(parseIPv6('12345::1')).toBeNull();
    expect(parseIPv6('2001:db8:0:0:0:0:0:0:1')).toBeNull(); // 9 grupos
  });

  test('a forma comprimida e a forma completa do MESMO endereço classificam igual', () => {
    expect(classifyAddress('::1')).toEqual(classifyAddress('0:0:0:0:0:0:0:1'));
    expect(classifyAddress('fc00::1')).toEqual(classifyAddress('fc00:0:0:0:0:0:0:1'));
  });
});

describe('formas numéricas ambíguas chegam aqui já canonicalizadas pelo parser de URL', () => {
  test('decimal, hexadecimal, octal e forma curta viram a forma pontilhada e são classificadas', () => {
    // é por isso que o classificador não tem (nem precisa de) um guarda próprio para elas
    for (const host of ['2130706433', '0x7f000001', '127.1', '0177.0.0.1']) {
      const { hostname } = new URL(`http://${host}/`);
      expect(hostname).toBe('127.0.0.1');
      expect(classifyAddress(hostname).allowed).toBe(false);
    }
    expect(new URL('http://0300.0250.0.1/').hostname).toBe('192.168.0.1');
  });

  test('formas numéricas inválidas fazem o próprio parser de URL lançar', () => {
    for (const host of ['999.999.999.999', '1.2.3.4.5', '12345678901234']) {
      expect(() => new URL(`http://${host}/`)).toThrow();
    }
  });
});
