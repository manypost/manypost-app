import { describe, expect, test } from 'bun:test';
import type { components } from '@/lib/api/schema';
import { type SchedulePayloadInput, buildSchedulePayload } from './submit-payload';

type Channel = components['schemas']['Channel'];

const canal = (id: string): Channel => ({
  id,
  provider: 'x',
  externalId: `ext-${id}`,
  name: id,
  username: id,
  avatarUrl: null,
  status: 'ACTIVE',
  scopes: null,
});

const QUANDO = new Date('2026-07-27T14:00:00.000Z');

const entrada = (over: Partial<SchedulePayloadInput> = {}): SchedulePayloadInput => ({
  text: '',
  overrides: {},
  channelSettings: {},
  mediaIds: [],
  thread: [],
  selected: [],
  publishAt: QUANDO,
  timezone: 'America/Sao_Paulo',
  requireApproval: false,
  ...over,
});

describe('caixa global vazia com todo canal personalizado', () => {
  test('o texto do primeiro canal vira o baseContent e nenhum override se perde', () => {
    const payload = buildSchedulePayload(
      entrada({
        text: '',
        selected: [canal('a'), canal('b')],
        overrides: { a: 'texto do a', b: 'texto do b' },
      }),
    );
    // a API exige `text` não-vazio e esta fatia não mexe no contrato
    expect(payload.text).toBe('texto do a');
    expect(payload.textByChannel).toEqual({ a: 'texto do a', b: 'texto do b' });
  });

  test('o base sai do primeiro canal QUE TEM texto, não do primeiro da lista', () => {
    const payload = buildSchedulePayload(
      entrada({ text: '', selected: [canal('a'), canal('b')], overrides: { b: 'só o b' } }),
    );
    expect(payload.text).toBe('só o b');
  });
});

describe('overrides', () => {
  test('override igual ao texto global continua viajando (nada é descartado em silêncio)', () => {
    const payload = buildSchedulePayload(
      entrada({ text: 'mesmo texto', selected: [canal('a')], overrides: { a: 'mesmo texto' } }),
    );
    expect(payload.textByChannel).toEqual({ a: 'mesmo texto' });
  });

  test('override em branco não vira texto do canal', () => {
    const payload = buildSchedulePayload(
      entrada({ text: 'global', selected: [canal('a')], overrides: { a: '   ' } }),
    );
    expect(payload.textByChannel).toEqual({});
    expect(payload.text).toBe('global');
  });

  test('override de canal desmarcado não vaza para o payload', () => {
    const payload = buildSchedulePayload(
      entrada({ text: 'global', selected: [canal('a')], overrides: { a: 'do a', z: 'saiu' } }),
    );
    expect(payload.textByChannel).toEqual({ a: 'do a' });
    expect(payload.channelIds).toEqual(['a']);
  });
});

describe('demais campos', () => {
  test('espaços em volta do texto são aparados', () => {
    expect(buildSchedulePayload(entrada({ text: '  oi  ', selected: [canal('a')] })).text).toBe('oi');
  });

  test('settings só do canal que tem alguma', () => {
    const payload = buildSchedulePayload(
      entrada({
        text: 'oi',
        selected: [canal('a'), canal('b')],
        channelSettings: { a: { board: '1' }, b: {} },
      }),
    );
    expect(payload.settingsByChannel).toEqual({ a: { board: '1' } });
  });

  test('item de thread sem mídia e sem espera não carrega as chaves', () => {
    const payload = buildSchedulePayload(
      entrada({
        text: 'oi',
        selected: [canal('a')],
        thread: [
          { text: ' réplica ', mediaIds: [], delaySec: 0 },
          { text: 'outra', mediaIds: ['m1'], delaySec: 30 },
        ],
      }),
    );
    expect(payload.thread).toEqual([
      { text: 'réplica' },
      { text: 'outra', mediaIds: ['m1'], delaySec: 30 },
    ]);
  });

  test('data vira ISO e o fuso segue junto', () => {
    const payload = buildSchedulePayload(entrada({ text: 'oi', selected: [canal('a')] }));
    expect(payload.publishAt).toBe('2026-07-27T14:00:00.000Z');
    expect(payload.timezone).toBe('America/Sao_Paulo');
  });
});
