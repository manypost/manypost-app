import { describe, expect, test } from 'bun:test';
import { ACCENT_TRANSLATE_FROM, ACCENT_TRANSLATE_TO } from '@manypost/contracts';
import { normalizarTexto } from './text';

/**
 * Paridade cliente ↔ servidor da dobra de acento.
 *
 * O servidor dobra por `translate(texto, FROM, TO)` no SQL da busca (publishing.repo.ts); o
 * cliente dobra por NFD na paleta e no Quadro. A tabela de `@manypost/contracts` é o contrato do
 * subconjunto em que os dois lados PRECISAM concordar: se um caractere entrar na tabela e a dobra
 * NFD não o cobrir (ou vice-versa em pt-BR), a busca diverge da paleta exatamente para quem
 * digita rápido, sem acento — o defeito que o e2e-search pegou na onda 34.
 */
describe('paridade da dobra de acento (JS ↔ tabela SQL)', () => {
  test('a tabela é bem formada: mesmo comprimento e sem duplicata no lado acentuado', () => {
    const from = [...ACCENT_TRANSLATE_FROM];
    const to = [...ACCENT_TRANSLATE_TO];
    expect(from.length).toBe(to.length);
    expect(new Set(from).size).toBe(from.length);
  });

  test('cada caractere da tabela dobra em JS para o MESMO alvo do translate', () => {
    const from = [...ACCENT_TRANSLATE_FROM];
    const to = [...ACCENT_TRANSLATE_TO];
    for (let i = 0; i < from.length; i++) {
      expect(normalizarTexto(from[i]!)).toBe(to[i]!);
    }
  });

  test('maiúsculas acentuadas dobram para o mesmo alvo minúsculo', () => {
    const from = [...ACCENT_TRANSLATE_FROM];
    const to = [...ACCENT_TRANSLATE_TO];
    for (let i = 0; i < from.length; i++) {
      expect(normalizarTexto(from[i]!.toUpperCase())).toBe(to[i]!);
    }
  });

  test('o caso da onda 34: "lancamento" acha "Lançamento" com os dois lados dobrados', () => {
    expect(normalizarTexto('Lançamento')).toBe('lancamento');
    expect(normalizarTexto('Lançamento').includes(normalizarTexto('lancamento'))).toBe(true);
  });
});
