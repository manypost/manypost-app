import { describe, expect, test } from 'bun:test';
import type { Editor } from '@tiptap/react';
import messages from '@/messages/pt-BR.json';
import { editorUtilizavel, textoParaAplicar, variantesParaOverrides } from './ai-actions';
import { REWRITE_EDIT_IDS, REWRITE_IDS, REWRITE_TONE_IDS } from './hooks';

const ai = messages.ai as Record<string, string>;

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

/**
 * Nenhuma legenda paga é descartada.
 *
 * O defeito: a aba global mandava todos os canais (a franquia cobra UM crédito por canal),
 * recebia N variantes adaptadas e aplicava `variants[0]` ao texto compartilhado. As outras N-1,
 * já pagas, morriam antes de qualquer olho humano — num controle chamado "adaptar para a rede".
 */
describe('distribuição das variantes pelos canais que as pediram', () => {
  const v = (channelId: string, text: string) => ({
    channelId,
    text,
    maxLength: 280,
    shortened: false,
  });

  test('cada canal pedido recebe a variante escrita para ele', () => {
    const out = variantesParaOverrides(
      [v('ch-1', 'para o X'), v('ch-2', 'para o LinkedIn'), v('ch-3', 'para o Insta')],
      ['ch-1', 'ch-2', 'ch-3'],
    );

    expect(out).toEqual([
      { channelId: 'ch-1', text: 'para o X' },
      { channelId: 'ch-2', text: 'para o LinkedIn' },
      { channelId: 'ch-3', text: 'para o Insta' },
    ]);
  });

  test('nenhuma variante paga é perdida: 5 canais produzem 5 aplicações', () => {
    const canais = ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5'];
    const out = variantesParaOverrides(
      canais.map((c) => v(c, `texto de ${c}`)),
      canais,
    );
    expect(out).toHaveLength(canais.length);
  });

  test('canal que não foi pedido é descartado (não confiar na resposta)', () => {
    const out = variantesParaOverrides([v('ch-1', 'ok'), v('ch-intruso', 'não pedi')], ['ch-1']);
    expect(out).toEqual([{ channelId: 'ch-1', text: 'ok' }]);
  });

  test('canal repetido na resposta entra uma vez só', () => {
    const out = variantesParaOverrides([v('ch-1', 'primeira'), v('ch-1', 'segunda')], ['ch-1']);
    expect(out).toEqual([{ channelId: 'ch-1', text: 'primeira' }]);
  });

  test('resposta vazia não vira aplicação vazia', () => {
    expect(variantesParaOverrides([], ['ch-1'])).toEqual([]);
  });
});

/**
 * As instruções de reescrita são PROMPT do servidor, selecionadas por id. O que vive no cliente é
 * só o rótulo — e todo id do catálogo precisa ter o seu, senão o menu mostra a chave crua.
 */
describe('catálogo de reescrita e catálogo de mensagens', () => {
  test('todo id oferecido tem rótulo traduzido', () => {
    for (const id of REWRITE_IDS) {
      expect(ai[`rewrite.${id}`], `falta a chave ai.rewrite.${id}`).toBeTruthy();
    }
  });

  test('os grupos do menu cobrem o catálogo inteiro, sem repetir', () => {
    const agrupados = [...REWRITE_EDIT_IDS, ...REWRITE_TONE_IDS];
    expect([...agrupados].sort()).toEqual([...REWRITE_IDS].sort());
    expect(new Set(agrupados).size).toBe(agrupados.length);
  });
});

/** a superfície de IA passou a viver no catálogo de mensagens — nenhuma string solta no JSX */
describe('cobertura de tradução da superfície de IA', () => {
  const OBRIGATORIAS = [
    'menuTitle',
    'triggerLabel',
    'credits',
    'creditsCost',
    'adaptToNetwork',
    'adaptToNetworkOne',
    'suggestHashtags',
    'rewriteGroup',
    'toneGroup',
    'lockedPro',
    'lockedPremium',
    'exhausted',
    'seePlans',
    'needChannel',
    'genericError',
    'workingAnnounce',
    'appliedOne',
    'appliedPerChannel',
    'shortenedNotice',
    'overLimitNotice',
    'applyAnyway',
    'discard',
    'undo',
    'undone',
    'dismiss',
    'describeImage',
    'describeError',
    'draftTrigger',
    'draftTitle',
    'draftDescription',
    'draftFieldLabel',
    'draftPlaceholder',
    'draftSubmit',
    'bestTimeTrigger',
    'bestTimeTitle',
    'bestTimeLoading',
    'bestTimeError',
    'bestTimeTimezone',
    'bestTimeBaseline',
    'bestTimeOwnHistory',
  ] as const;

  test('existe uma mensagem para cada chave usada pelos componentes', () => {
    for (const key of OBRIGATORIAS) {
      expect(ai[key], `falta a chave ai.${key}`).toBeTruthy();
    }
  });

  /**
   * A frase do melhor horário não pode prometer medição de desempenho: o sinal disponível é
   * frequência de publicação. Este teste prende a HONESTIDADE do texto, não o texto.
   */
  test('a frase do histórico próprio não afirma desempenho', () => {
    const frase = ai.bestTimeOwnHistory!.toLowerCase();
    expect(frase).toContain('mais usa');
    for (const proibida of ['desempenho', 'performance', 'melhor resultado', 'engajamento']) {
      // "ainda não medimos desempenho" é permitido; afirmar que mediu não é
      if (frase.includes(proibida)) {
        expect(frase).toContain('ainda não');
      }
    }
  });

  test('o aviso de encurtamento nomeia a rede e o limite', () => {
    expect(ai.shortenedNotice).toContain('{network}');
    expect(ai.shortenedNotice).toContain('{max}');
  });

  test('o aviso de excesso deixa claro que nada foi cortado', () => {
    expect(ai.overLimitNotice!.toLowerCase()).toContain('nada foi cortado');
  });
});
