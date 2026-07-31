import { describe, expect, test } from 'bun:test';
import { abrePalette, focoEmCampoDeTexto, moverSelecao } from './palette-keys';

describe('abrePalette', () => {
  test('⌘K abre', () => {
    expect(abrePalette({ key: 'k', metaKey: true })).toBe(true);
  });

  test('Ctrl+K abre (Linux/Windows)', () => {
    expect(abrePalette({ key: 'k', ctrlKey: true })).toBe(true);
  });

  test('K maiúsculo também abre — Shift não pode desligar o atalho', () => {
    expect(abrePalette({ key: 'K', metaKey: true })).toBe(true);
  });

  test('K sozinho NÃO abre', () => {
    expect(abrePalette({ key: 'k' })).toBe(false);
  });

  test('outra tecla com modificador não abre', () => {
    expect(abrePalette({ key: 'j', metaKey: true })).toBe(false);
  });

  test('auto-repeat não reabre: segurar a tecla é um gesto só', () => {
    expect(abrePalette({ key: 'k', metaKey: true, repeat: true })).toBe(false);
  });

  test.each([['INPUT'], ['TEXTAREA'], ['SELECT']])(
    'NÃO abre com o foco em <%s> — abrir a paleta no meio de um post é o pior defeito possível',
    (tag) => {
      expect(abrePalette({ key: 'k', metaKey: true, target: { tagName: tag } })).toBe(false);
    },
  );

  test('NÃO abre dentro de um editor rico (contenteditable, como o composer)', () => {
    expect(
      abrePalette({ key: 'k', metaKey: true, target: { tagName: 'DIV', isContentEditable: true } }),
    ).toBe(false);
  });

  test('abre com o foco num elemento comum', () => {
    expect(abrePalette({ key: 'k', metaKey: true, target: { tagName: 'BODY' } })).toBe(true);
  });

  test('alvo nulo não estoura', () => {
    expect(abrePalette({ key: 'k', metaKey: true, target: null })).toBe(true);
  });
});

describe('focoEmCampoDeTexto', () => {
  test('tagName em caixa baixa também é reconhecido', () => {
    expect(focoEmCampoDeTexto({ tagName: 'input' })).toBe(true);
  });

  test('botão não é campo de texto', () => {
    expect(focoEmCampoDeTexto({ tagName: 'BUTTON' })).toBe(false);
  });
});

describe('moverSelecao: dá a volta nas pontas', () => {
  test('desce', () => {
    expect(moverSelecao('ArrowDown', 0, 3)).toBe(1);
  });

  test('do fim, descer volta ao começo', () => {
    expect(moverSelecao('ArrowDown', 2, 3)).toBe(0);
  });

  test('do começo, subir vai para o fim', () => {
    expect(moverSelecao('ArrowUp', 0, 3)).toBe(2);
  });

  test('Home e End vão às pontas', () => {
    expect(moverSelecao('Home', 2, 3)).toBe(0);
    expect(moverSelecao('End', 0, 3)).toBe(2);
  });

  test('tecla irrelevante não move', () => {
    expect(moverSelecao('a', 1, 3)).toBe(1);
  });

  test('lista vazia devolve -1 em vez de um índice inválido', () => {
    expect(moverSelecao('ArrowDown', 0, 0)).toBe(-1);
  });
});
