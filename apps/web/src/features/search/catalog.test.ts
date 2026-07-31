import { describe, expect, test } from 'bun:test';
import messages from '@/messages/pt-BR.json';
import { ACOES, CATALOGO, PESO, TELAS } from './catalog';
import { normalizar } from './ranking';

const entradas = (messages.commandPalette as { entries: Record<string, string> }).entries;

const RAIZ_DAS_ROTAS = new URL('../../app/(app)/', import.meta.url).pathname;

describe('catálogo de telas', () => {
  /**
   * O teste que justifica o catálogo existir como dado: se alguém renomear ou mover uma rota, a
   * paleta passaria a levar a um 404 sem nenhum aviso — nenhum typecheck pega uma string de href.
   */
  test('toda tela do catálogo tem uma rota de verdade', async () => {
    for (const tela of TELAS) {
      const segmento = tela.href!.replace(/^\//, '');
      const arquivo = Bun.file(`${RAIZ_DAS_ROTAS}${segmento}/page.tsx`);
      expect(await arquivo.exists(), `sem rota para ${tela.href}`).toBe(true);
    }
  });

  test('nenhuma rota de (app) ficou de fora da paleta sem querer', async () => {
    const rotas = new Set<string>();
    for await (const caminho of new Bun.Glob('*/page.tsx').scan({ cwd: RAIZ_DAS_ROTAS })) {
      rotas.add(`/${caminho.replace('/page.tsx', '')}`);
    }
    const noCatalogo = new Set(TELAS.map((t) => t.href));
    expect([...rotas].filter((r) => !noCatalogo.has(r))).toEqual([]);
  });

  test('toda tela navega e nenhuma ação navega — os dois tipos não se misturam', () => {
    for (const t of TELAS) {
      expect(t.href).toBeTruthy();
      expect(t.acao).toBeUndefined();
    }
    for (const a of ACOES) {
      expect(a.acao).toBeTruthy();
      expect(a.href).toBeUndefined();
    }
  });
});

describe('integridade do catálogo', () => {
  test('todo id é único', () => {
    const ids = CATALOGO.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('toda entrada tem tradução', () => {
    for (const e of CATALOGO) {
      expect(typeof entradas[e.chaveDeRotulo], `falta commandPalette.entries.${e.id}`).toBe('string');
    }
  });

  test('os termos de busca são normalizados — senão "conexoes" não acharia "conexões"', () => {
    for (const e of CATALOGO) {
      expect(e.termos, `${e.id} tem termos com acento ou caixa alta`).toBe(normalizar(e.termos));
    }
  });

  test('ação vem antes de tela no desempate, e post por último', () => {
    expect(PESO.action).toBeLessThan(PESO.page);
    expect(PESO.page).toBeLessThan(PESO.channel);
    expect(PESO.channel).toBeLessThan(PESO.post);
  });

  test('ações vêm antes das telas na ordem do catálogo (empate total é resolvido por ela)', () => {
    expect(CATALOGO.slice(0, ACOES.length).every((e) => e.tipo === 'action')).toBe(true);
  });
});
