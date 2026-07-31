import { describe, expect, test } from 'bun:test';
import { chavesInvalidadasPor, EVENTOS_SSE } from './invalidations';

const contem = (chaves: readonly string[][], alvo: string) =>
  chaves.some((c) => c[0] === alvo);

describe('o que cada evento do SSE invalida', () => {
  test.each(['post.scheduled', 'post.published', 'post.failed'] as const)(
    '%s invalida o resumo da HOME — era o buraco: a tela mostrava dado velho até o staleTime ou o foco',
    (evento) => {
      expect(contem(chavesInvalidadasPor(evento), 'insights')).toBe(true);
    },
  );

  test.each(['post.scheduled', 'post.published', 'post.failed'] as const)(
    '%s continua invalidando o feed e o detalhe do grupo',
    (evento) => {
      const chaves = chavesInvalidadasPor(evento);
      expect(contem(chaves, 'publications')).toBe(true);
      expect(contem(chaves, 'post-group')).toBe(true);
    },
  );

  test('canal pedindo reconexão invalida canais E o resumo — a home conta canais com problema', () => {
    const chaves = chavesInvalidadasPor('channel.refresh_required');
    expect(contem(chaves, 'channels')).toBe(true);
    expect(contem(chaves, 'insights')).toBe(true);
  });

  test('notificação nova invalida só notificações — não mexe em contagem operacional', () => {
    expect(chavesInvalidadasPor('notification.created')).toEqual([['notifications']]);
  });

  test('evento desconhecido não invalida nada em vez de invalidar tudo por precaução', () => {
    expect(chavesInvalidadasPor('evento.que.nao.existe')).toEqual([]);
  });

  test('todo evento que o stream escuta tem mapeamento — nenhum chega e é ignorado em silêncio', () => {
    for (const evento of EVENTOS_SSE) {
      expect(chavesInvalidadasPor(evento).length).toBeGreaterThan(0);
    }
  });

  test('as chaves da home nascem sob o prefixo publications, então já são cobertas', () => {
    // pipeline/upcoming/drafts usam ['publications', ...]; invalidar o prefixo alcança todas
    expect(contem(chavesInvalidadasPor('post.published'), 'publications')).toBe(true);
  });
});
