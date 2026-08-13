'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Resumo operacional da tela inicial.
 *
 * `staleTime` curto de propósito: este é o painel do "está tudo bem?", e um número velho aqui é
 * pior que uma requisição extra — uma falha nova ficaria invisível, e uma falha já resolvida
 * continuaria aparecendo depois de a pessoa arrumar, o que ensina a não confiar na tela. Pelo
 * mesmo motivo o servidor **não** guarda cache (ver `insights.routes.ts`).
 */
export interface InsightsSummary {
  timezone: string;
  attention: {
    failed: number;
    needsReview: number;
    awaitingApproval: number;
    partial: number;
    channels: Array<{
      channelId: string;
      provider: string;
      name: string | null;
      status: string;
    }>;
    total: number;
  };
  today: { scheduled: number; published: number; failed: number };
  week: { scheduled: number; byDay: number[] };
  firstRun: 'no_channels' | 'no_posts' | null;
}

export function useInsightsSummary() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery({
    queryKey: ['insights', 'summary', timezone],
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/insights/summary', {
        params: { query: { tz: timezone } },
      });
      if (error) throw error;
      return data as InsightsSummary;
    },
  });
}

/**
 * As próximas publicações agendadas.
 *
 * Leitura própria, e não uma fatia do feed do pipeline, por duas razões: precisão (o pipeline tem
 * teto e pode truncar justamente o futuro) e isolamento — se esta falhar, o resto da home continua
 * de pé, que é o que a spec exige.
 */
export function useUpcomingPublications() {
  return useQuery({
    queryKey: ['publications', 'upcoming'],
    staleTime: 20_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/publications', {
        params: {
          query: { from: new Date().toISOString(), state: 'SCHEDULED', limit: '20' },
        },
      });
      if (error) throw error;
      return data?.items ?? [];
    },
  });
}

/**
 * Rascunhos do servidor.
 *
 * **Sem `from`, de propósito.** Um grupo em `DRAFT` tem `publishAt = null`, e o feed filtra com
 * `publishAt >= from` — qualquer janela excluiria exatamente o que se quer ver. É por isso que esta
 * é uma consulta separada, e não um recorte das outras.
 */
export function useDraftGroups() {
  return useQuery({
    queryKey: ['publications', 'drafts'],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/publications', {
        params: { query: { state: 'DRAFT', limit: '50' } },
      });
      if (error) throw error;
      return data?.items ?? [];
    },
  });
}
