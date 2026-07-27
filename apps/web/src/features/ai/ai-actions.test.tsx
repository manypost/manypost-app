import { describe, expect, test } from 'bun:test';
import type { Editor } from '@tiptap/react';
import { editorUtilizavel, textoParaAplicar } from './ai-actions';

/**
 * Regressão de um erro REAL em uso (`Cannot read properties of null (reading 'nodes')`).
 *
 * O componente lia o texto do editor durante o render (`editor.getText()`). O `?.` não
 * protegia: a instância do TipTap EXISTE antes de a view montar (`immediatelyRender: false`) e
 * continua existindo depois de destruída pelo remount do `editorNonce` — nos dois casos
 * `editor.state` é null e a leitura estoura lá dentro.
 *
 * A correção tem duas partes, e as duas estão presas aqui:
 *  1. o texto passou a vir do STORE (nunca do editor) — o editor é só para escrever;
 *  2. escrever exige instância utilizável, não apenas não-nula.
 */
describe('leitura e escrita seguras no editor do composer', () => {
  test('editor ausente não é utilizável', () => {
    expect(editorUtilizavel(null)).toBe(false);
  });

  test('editor destruído pelo remount NÃO é utilizável, mesmo existindo', () => {
    const destruido = { isDestroyed: true } as unknown as Editor;
    expect(editorUtilizavel(destruido)).toBe(false);
  });

  test('editor vivo é utilizável', () => {
    const vivo = { isDestroyed: false } as unknown as Editor;
    expect(editorUtilizavel(vivo)).toBe(true);
  });

  // o coração do bug: mesmo com um editor que estoura ao ser lido, o componente tem o texto
  test('o texto vem do store, então um editor que estoura ao ser lido não quebra a tela', () => {
    const editorQueEstoura = {
      isDestroyed: false,
      getText: () => {
        throw new TypeError("Cannot read properties of null (reading 'nodes')");
      },
    } as unknown as Editor;

    expect(() => textoParaAplicar('texto do store', editorQueEstoura)).not.toThrow();
    expect(textoParaAplicar('texto do store', editorQueEstoura)).toBe('texto do store');
  });

  test('acrescentar parte do texto do store, não de uma leitura do editor', () => {
    expect(textoParaAplicar('legenda', null)).toBe('legenda');
  });
});
