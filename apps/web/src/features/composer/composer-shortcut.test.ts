import { describe, expect, test } from 'bun:test';
import { podeAgendarPorAtalho } from './composer-shortcut';

describe('atalho de agendamento', () => {
  test('agenda somente quando o composer está livre e válido', () => {
    expect(
      podeAgendarPorAtalho({
        bloqueado: false,
        enviando: false,
        overlayBloqueanteAberto: false,
        repeticao: false,
      }),
    ).toBe(true);
  });

  test.each([
    ['validação pendente', { bloqueado: true }],
    ['envio em andamento', { enviando: true }],
    ['confirmação de descarte aberta', { overlayBloqueanteAberto: true }],
    ['tecla mantida pressionada', { repeticao: true }],
  ])('não agenda com %s', (_motivo, alteracao) => {
    expect(
      podeAgendarPorAtalho({
        bloqueado: false,
        enviando: false,
        overlayBloqueanteAberto: false,
        repeticao: false,
        ...alteracao,
      }),
    ).toBe(false);
  });
});
