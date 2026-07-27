import { describe, expect, it } from 'bun:test';
import { parseStructured } from './structured';

describe('leitura defensiva de saída estruturada', () => {
  it('lê JSON puro', () => {
    expect(parseStructured('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('tira a cerca de código', () => {
    expect(parseStructured('```json\n{"a":1}\n```')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseStructured('```\n[1,2]\n```')).toEqual({ ok: true, value: [1, 2] });
  });

  it('ignora conversa antes e depois do objeto', () => {
    const raw = 'Claro! Aqui está:\n{"a":1, "b":"x"}\nEspero ter ajudado.';
    expect(parseStructured(raw)).toEqual({ ok: true, value: { a: 1, b: 'x' } });
  });

  it('não se perde com chave de fechamento DENTRO de uma string', () => {
    const raw = 'texto {"t":"um } aqui dentro","n":2} fim';
    expect(parseStructured(raw)).toEqual({ ok: true, value: { t: 'um } aqui dentro', n: 2 } });
  });

  it('não se perde com aspas escapadas', () => {
    const raw = '{"t":"ele disse \\"oi\\" }","n":1}';
    expect(parseStructured(raw)).toEqual({ ok: true, value: { t: 'ele disse "oi" }', n: 1 } });
  });

  it('lê objeto aninhado inteiro, não só o primeiro fechamento', () => {
    const raw = 'ok {"a":{"b":{"c":1}},"d":2} pronto';
    expect(parseStructured(raw)).toEqual({ ok: true, value: { a: { b: { c: 1 } }, d: 2 } });
  });

  // o caso que importa: falha vira `ok:false` para o caso de uso DEVOLVER a franquia,
  // em vez de estourar uma exceção crua no meio da reserva
  it.each(['', 'só texto, nada estruturado', '{"a":', '{ isso não é json }'])(
    'reporta falha em vez de lançar: %p',
    (raw) => {
      expect(parseStructured(raw)).toEqual({ ok: false });
    },
  );
});
