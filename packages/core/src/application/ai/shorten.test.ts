import { describe, expect, it } from 'bun:test';
import { shortenTo } from './shorten';

describe('garantia determinística de tamanho (SPEC_AI §5.5)', () => {
  it('texto dentro do limite passa intacto e sem marca', () => {
    expect(shortenTo('curto', 100)).toEqual({ text: 'curto', shortened: false });
  });

  it('apara espaço em volta sem contar como encurtamento', () => {
    expect(shortenTo('  curto  ', 100)).toEqual({ text: 'curto', shortened: false });
  });

  it('corta na última frase completa que cabe', () => {
    const raw = 'Primeira frase. Segunda frase. Terceira frase que estoura o limite.';
    const { text, shortened } = shortenTo(raw, 32);
    expect(shortened).toBe(true);
    expect(text).toBe('Primeira frase. Segunda frase.');
    expect(text.length).toBeLessThanOrEqual(32);
  });

  it('quando a frase cortaria demais, corta na palavra em vez de devolver quase nada', () => {
    const raw = `Oi. ${'palavra '.repeat(40)}`;
    const { text } = shortenTo(raw, 100);
    expect(text.length).toBeGreaterThan(50); // não caiu no "Oi." do começo
    expect(text.endsWith('palavra')).toBe(true);
  });

  it('nunca corta no meio de uma palavra', () => {
    const { text } = shortenTo('abcdefgh ijklmnop qrstuvwx', 20);
    expect(text).toBe('abcdefgh ijklmnop');
  });

  // o limite é o que o usuário conta: emoji é UM caractere, não dois code units
  it('conta por caractere, então emoji não faz o texto estourar o limite', () => {
    const raw = '🎉'.repeat(50);
    const { text, shortened } = shortenTo(raw, 10);
    expect(shortened).toBe(true);
    expect([...text].length).toBeLessThanOrEqual(10);
  });

  it('uma palavra única maior que o limite ainda respeita o limite', () => {
    const { text, shortened } = shortenTo('a'.repeat(500), 100);
    expect(shortened).toBe(true);
    expect(text.length).toBe(100);
  });

  it('limite zero devolve vazio marcado como encurtado', () => {
    expect(shortenTo('qualquer coisa', 0)).toEqual({ text: '', shortened: true });
  });

  it('reconhece fim de frase com aspas e reticências', () => {
    const raw = 'Ele disse "vamos!" Depois saiu correndo pela porta da frente.';
    const { text } = shortenTo(raw, 25);
    expect(text).toBe('Ele disse "vamos!"');
  });

  // a propriedade que o critério de aceite pede: em 100% dos casos, cabe
  it('propriedade: qualquer entrada e qualquer limite resultam em texto dentro do limite', () => {
    const entradas = [
      'a',
      'a'.repeat(1000),
      'Frase. '.repeat(200),
      '🎉🎉🎉 misturado com texto normal. '.repeat(30),
      '   ',
      'sem-espaco-nenhum-por-muito-tempo'.repeat(20),
    ];
    for (const raw of entradas) {
      for (const limite of [1, 10, 63, 280, 500, 2200, 4000]) {
        expect([...shortenTo(raw, limite).text].length).toBeLessThanOrEqual(limite);
      }
    }
  });
});
