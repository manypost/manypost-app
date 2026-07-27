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
