'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import { kanbanFeedParams, type FeedItem } from './logic';

/** teto de páginas do laço: 5 × 200 = 1000 itens */
const MAX_PAGINAS = 5;
const POR_PAGINA = 200;
export const TETO_DO_QUADRO = MAX_PAGINAS * POR_PAGINA;

export interface PipelineFeed {
  items: FeedItem[];
  /** a janela tinha MAIS do que o teto — a tela precisa dizer isso em vez de fingir completude */
  truncado: boolean;
}

/**
 * Feed do pipeline — a leitura que o quadro e a home COMPARTILHAM.
 *
 * Duas decisões que valem registro:
 *
 * 1. **O laço de cursor não é otimização, é correção.** `GET /v1/publications` ordena por
 *    `publish_at ASC` e corta em `limit`. O quadro pedia 200 itens numa janela de 30 dias: numa
 *    organização com mais de 200 publicações no período, o corte pegava as 200 **mais antigas** e a
 *    coluna "Agendado" aparecia vazia — a tela afirmava um estado em que a organização não estava.
 *    Seguindo o cursor keyset que o endpoint já devolve, a janela é lida inteira até um teto; e
 *    quando o teto é atingido, `truncado` obriga a tela a dizer.
 *
 * 2. **Uma chave de cache, duas telas.** A home mostra o mesmo pipeline resumido. Compartilhar a
 *    chave (e por isso `kanbanFeedParams` ser estável dentro do dia civil) garante que as duas
 *    superfícies não possam reportar números diferentes do mesmo pipeline — e navegar de uma para a
 *    outra não custa requisição.
 *
 * `refetchInterval` fica por observador: o quadro faz polling de 30s, a home não.
 */
export function usePipelineFeed(dias = 30, opts: { refetchInterval?: number } = {}) {
  const params = kanbanFeedParams(dias);
  return useQuery({
    queryKey: ['publications', 'pipeline', params],
    staleTime: 20_000,
    ...(opts.refetchInterval ? { refetchInterval: opts.refetchInterval } : {}),
    queryFn: async (): Promise<PipelineFeed> => {
      const items: FeedItem[] = [];
      let cursor: string | undefined;

      for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        const data = unwrap(await api.GET('/v1/publications', {
          params: {
            query: {
              from: params.from,
              limit: String(POR_PAGINA),
              ...(cursor ? { cursor } : {}),
            },
          },
        }));
        items.push(...((data?.items ?? []) as FeedItem[]));
        cursor = data?.nextCursor ?? undefined;
        if (!cursor) return { items, truncado: false };
      }

      // saiu do laço com cursor sobrando: a janela tem mais do que conseguimos ler
      return { items, truncado: true };
    },
  });
}
