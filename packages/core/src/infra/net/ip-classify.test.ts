import { describe, expect, test } from 'bun:test';
import { classifyAddress, isPublicAddress, parseIpv4, parseIpv6 } from './ip-classify';

describe('parseIpv4', () => {
  test('aceita dotted decimal canônico', () => {
    expect(parseIpv4('8.8.8.8')).toBe(((8 << 24) | (8 << 16) | (8 << 8) | 8) >>> 0);
  });
  test('rejeita leading zeros e formas curtas', () => {
    expect(parseIpv4('08.1.1.1')).toBeNull();
    expect(parseIpv4('1.2.3')).toBeNull();
    expect(parseIpv4('1.2.3.4.5')).toBeNull();
  });
});

describe('classifyAddress IPv4', () => {
  test('públicos', () => {
    expect(classifyAddress('8.8.8.8').classification).toBe('public');
    expect(classifyAddress('1.1.1.1').classification).toBe('public');
  });
  test('privados e especiais', () => {
    expect(classifyAddress('10.0.0.1').classification).toBe('private');
    expect(classifyAddress('192.168.1.1').classification).toBe('private');
    expect(classifyAddress('172.16.0.1').classification).toBe('private');
    expect(classifyAddress('172.31.255.255').classification).toBe('private');
    expect(classifyAddress('127.0.0.1').classification).toBe('loopback');
    expect(classifyAddress('169.254.1.1').classification).toBe('link_local');
    expect(classifyAddress('100.64.0.1').classification).toBe('cgnat');
    expect(classifyAddress('0.0.0.0').classification).toBe('unspecified');
    expect(classifyAddress('224.0.0.1').classification).toBe('multicast');
    expect(classifyAddress('192.0.2.1').classification).toBe('documentation');
    expect(classifyAddress('198.18.0.1').classification).toBe('reserved'); // benchmarking
    expect(classifyAddress('198.19.255.255').classification).toBe('reserved');
  });

  test('as bordas das faixas continuam públicas', () => {
    expect(classifyAddress('198.17.255.255').classification).toBe('public'); // antes do benchmarking
    expect(classifyAddress('198.20.0.0').classification).toBe('public'); // depois do benchmarking
    expect(classifyAddress('172.15.0.1').classification).toBe('public');
    expect(classifyAddress('172.32.0.1').classification).toBe('public');
    expect(classifyAddress('100.63.255.255').classification).toBe('public');
    expect(classifyAddress('100.128.0.1').classification).toBe('public');
  });
});

describe('classifyAddress IPv6', () => {
  test('loopback e ULA', () => {
    expect(classifyAddress('::1').classification).toBe('loopback');
    expect(classifyAddress('fc00::1').classification).toBe('private');
    expect(classifyAddress('fd12:3456:789a::1').classification).toBe('private');
  });
  test('link-local e documentação', () => {
    expect(classifyAddress('fe80::1').classification).toBe('link_local');
    expect(classifyAddress('2001:db8::1').classification).toBe('documentation');
  });
  test('IPv4-mapped de privado é privado', () => {
    expect(classifyAddress('::ffff:192.168.0.1').classification).toBe('private');
    expect(classifyAddress('::ffff:127.0.0.1').classification).toBe('loopback');
  });
  test('IPv4-mapped público', () => {
    expect(classifyAddress('::ffff:8.8.8.8').classification).toBe('public');
  });

  /**
   * O IPv4-mapped não é o único encapsulamento que carrega um IPv4 dentro de um IPv6. Estes
   * três passavam como `public` porque a classificação parava no `::ffff:`, e um IPv4 privado
   * escondido num deles é a mesma classe de furo — só muda o invólucro.
   */
  test('NAT64, 6to4 e IPv4-compatible são classificados pelo endereço embutido', () => {
    expect(classifyAddress('64:ff9b::7f00:1').classification).toBe('loopback');
    expect(classifyAddress('64:ff9b::a9fe:a9fe').classification).toBe('link_local');
    expect(classifyAddress('64:ff9b::a00:1').classification).toBe('private');
    expect(classifyAddress('2002:7f00:1::1').classification).toBe('loopback');
    expect(classifyAddress('2002:a9fe:a9fe::1').classification).toBe('link_local');
    expect(classifyAddress('2002:c0a8:1::1').classification).toBe('private');
    expect(classifyAddress('::127.0.0.1').classification).toBe('loopback');
    expect(classifyAddress('::169.254.169.254').classification).toBe('link_local');
  });

  test('os mesmos encapsulamentos com IPv4 público continuam públicos', () => {
    expect(classifyAddress('64:ff9b::808:808').classification).toBe('public');
    expect(classifyAddress('2002:808:808::1').classification).toBe('public');
    expect(classifyAddress('::8.8.8.8').classification).toBe('public');
  });

  test('o prefixo local do NAT64 (64:ff9b:1::/48) não carrega IPv4 e é reservado', () => {
    expect(classifyAddress('64:ff9b:1::1').classification).toBe('reserved');
  });
  test('zone id é inválido', () => {
    expect(classifyAddress('fe80::1%eth0').classification).toBe('invalid');
  });
  test('público real', () => {
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });
});

describe('parseIpv6', () => {
  test('expande ::', () => {
    expect(parseIpv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });
});
