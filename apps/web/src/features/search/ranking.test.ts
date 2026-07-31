import { describe, expect, test } from 'bun:test';
import { normalizar, ordenar, pontuar, type Rankeavel } from './ranking';

describe('normalizar: acento e caixa não podem esconder um resultado', () => {
  test('tira diacrítico', () => {
    expect(normalizar('Conexões')).toBe('conexoes');
    expect(normalizar('Notificações')).toBe('notificacoes');
    expect(normalizar('Mídia')).toBe('midia');
  });

  test('baixa a caixa', () => {
    expect(normalizar('CALENDÁRIO')).toBe('calendario');
  });

  test('texto já normalizado passa igual', () => {
    expect(normalizar('kanban')).toBe('kanban');
  });

  test('string vazia não estoura', () => {
    expect(normalizar('')).toBe('');
  });
});

describe('pontuar: prefixo > início de palavra > substring > subsequência', () => {
  test('prefixo exato do começo pontua mais que o meio', () => {
    expect(pontuar('calendario', 'cal')).toBeGreaterThan(pontuar('meu calendario', 'cal'));
  });

  test('início de palavra pontua mais que substring solta', () => {
    expect(pontuar('novo post', 'post')).toBeGreaterThan(pontuar('composer', 'pos'));
  });

  test('substring pontua mais que subsequência espalhada', () => {
    expect(pontuar('conexoes', 'nexo')).toBeGreaterThan(pontuar('conexoes', 'cxs'));
  });

  test('subsequência ainda casa — digitar rápido não pode zerar o resultado', () => {
    expect(pontuar('configuracoes', 'cfg')).toBeGreaterThan(0);
  });

  test('sem casamento nenhum devolve 0', () => {
    expect(pontuar('calendario', 'zzz')).toBe(0);
  });

  test('consulta vazia devolve 0 — a paleta não lista tudo por engano', () => {
    expect(pontuar('calendario', '')).toBe(0);
  });

  test('ignora acento nos dois lados', () => {
    expect(pontuar('Conexões', 'conexoes')).toBeGreaterThan(0);
    expect(pontuar('conexoes', 'Conexões')).toBeGreaterThan(0);
  });
});

describe('ordenar: determinístico, e é isso que faz a primeira linha ser confiável', () => {
  const itens: Rankeavel[] = [
    { chave: 'a', rotulo: 'Calendário', termos: 'agenda', peso: 2 },
    { chave: 'b', rotulo: 'Canais conectados', termos: 'conexoes', peso: 2 },
    { chave: 'c', rotulo: 'Criar post', termos: 'novo compor', peso: 1 },
  ];

  test('a mesma consulta sobre os mesmos dados dá sempre a mesma ordem', () => {
    expect(ordenar(itens, 'ca', 10)).toEqual(ordenar(itens, 'ca', 10));
  });

  test('empate de pontuação é desempatado pelo peso do tipo (ação antes de tela)', () => {
    const empatados: Rankeavel[] = [
      { chave: 'tela', rotulo: 'Post', termos: '', peso: 2 },
      { chave: 'acao', rotulo: 'Post', termos: '', peso: 1 },
    ];
    expect(ordenar(empatados, 'post', 10).map((i) => i.chave)).toEqual(['acao', 'tela']);
  });

  test('empate total mantém a ordem do catálogo (estável)', () => {
    const iguais: Rankeavel[] = [
      { chave: 'primeiro', rotulo: 'Post', termos: '', peso: 1 },
      { chave: 'segundo', rotulo: 'Post', termos: '', peso: 1 },
    ];
    expect(ordenar(iguais, 'post', 10).map((i) => i.chave)).toEqual(['primeiro', 'segundo']);
  });

  test('casa também pelos termos, não só pelo rótulo', () => {
    expect(ordenar(itens, 'agenda', 10).map((i) => i.chave)).toEqual(['a']);
  });

  test('respeita o limite pedido', () => {
    expect(ordenar(itens, 'c', 2)).toHaveLength(2);
  });

  test('nada casa devolve lista vazia — a paleta diz "nada", não preenche espaço', () => {
    expect(ordenar(itens, 'zzzz', 10)).toEqual([]);
  });

  test('consulta vazia devolve vazio em vez do catálogo inteiro', () => {
    expect(ordenar(itens, '', 10)).toEqual([]);
  });

  test('"conexoes" sem acento acha "Canais conectados" pelos termos', () => {
    expect(ordenar(itens, 'conexoes', 10).map((i) => i.chave)).toContain('b');
  });
});
