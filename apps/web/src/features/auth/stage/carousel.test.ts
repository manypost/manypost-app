import { describe, expect, it } from 'bun:test';
import { autoplayEligible, wrapIndex } from './carousel';

describe('índice do carrossel do palco', () => {
  it('avança dentro do intervalo', () => {
    expect(wrapIndex(1, 3)).toBe(1);
    expect(wrapIndex(2, 3)).toBe(2);
  });

  it('volta ao primeiro ao passar do último', () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(4, 3)).toBe(1);
  });

  it('vai ao último ao voltar do primeiro', () => {
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(-2, 3)).toBe(1);
  });

  it('nunca devolve índice inválido, mesmo com entrada absurda', () => {
    for (const n of [-31, -7, 0, 5, 99]) {
      const i = wrapIndex(n, 3);
      expect(Number.isInteger(i)).toBe(true);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(3);
    }
  });

  it('degrada para 0 quando não há slides', () => {
    expect(wrapIndex(2, 0)).toBe(0);
  });
});

describe('elegibilidade do autoplay', () => {
  it('roda quando em repouso, com movimento permitido e mais de um slide', () => {
    expect(autoplayEligible({ paused: false, reducedMotion: false, count: 3 })).toBe(true);
  });

  it('não roda enquanto pausado por hover ou foco', () => {
    expect(autoplayEligible({ paused: true, reducedMotion: false, count: 3 })).toBe(false);
  });

  it('não roda sob prefers-reduced-motion', () => {
    expect(autoplayEligible({ paused: false, reducedMotion: true, count: 3 })).toBe(false);
  });

  it('não roda com um slide só (não há para onde avançar)', () => {
    expect(autoplayEligible({ paused: false, reducedMotion: false, count: 1 })).toBe(false);
    expect(autoplayEligible({ paused: false, reducedMotion: false, count: 0 })).toBe(false);
  });
});
