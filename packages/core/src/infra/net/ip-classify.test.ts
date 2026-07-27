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
