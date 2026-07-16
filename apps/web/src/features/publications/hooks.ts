'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Feed flat de publicações (SPEC_FRONTEND §3.1): o cliente agrupa por dia/grupo.
 * Realtime v1 = polling 30s + refetch on focus (SSE na UI vem na fatia SSE);
 * v1 lê uma página de 200 — paginação por cursor entra com o calendário completo.
 */
export function usePublicationsFeed(params: { from?: string } = {}) {
  return useQuery({
    queryKey: ['publications', params],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/publications', {
        params: { query: { ...(params.from ? { from: params.from } : {}), limit: '200' } },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}
