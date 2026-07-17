'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Feed flat de publicações (SPEC_FRONTEND §3.1): o cliente agrupa por dia/grupo.
 * SSE invalida a query; polling 30s continua como fallback (melhor esforço).
 * v1 lê uma página de 200 — paginação por cursor entra depois.
 */
export function usePublicationsFeed(
  params: { from?: string; to?: string; channelId?: string; state?: string } = {},
) {
  return useQuery({
    queryKey: ['publications', params],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/publications', {
        params: {
          query: {
            ...(params.from ? { from: params.from } : {}),
            ...(params.to ? { to: params.to } : {}),
            ...(params.channelId ? { channelId: params.channelId } : {}),
            ...(params.state ? { state: params.state } : {}),
            limit: '200',
          },
        },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}

/** fetcher exportado p/ uso imperativo via queryClient (ex.: duplicar post) */
export async function fetchPostGroup(groupId: string) {
  const { data, error } = await api.GET('/v1/posts/{groupId}', {
    params: { path: { groupId } },
  });
  if (error) throw error;
  return data;
}

export function usePostGroup(groupId: string | null) {
  return useQuery({
    queryKey: ['post-group', groupId],
    queryFn: () => fetchPostGroup(groupId!),
    enabled: groupId !== null,
  });
}

function useInvalidatePost() {
  const queryClient = useQueryClient();
  return (groupId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['publications'] });
    queryClient.invalidateQueries({ queryKey: groupId ? ['post-group', groupId] : ['post-group'] });
  };
}

/** PATCH texto/horário/settings — editar `text` sobrescreve TODAS as publicações do grupo (overrides resetam). */
export function useReschedulePost() {
  const invalidate = useInvalidatePost();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      text?: string;
      publishAt?: string;
      settingsByChannel?: Record<string, Record<string, unknown>>;
    }) => {
      const { data, error } = await api.PATCH('/v1/posts/{groupId}', {
        params: { path: { groupId: input.groupId } },
        body: {
          ...(input.text !== undefined ? { text: input.text } : {}),
          ...(input.publishAt !== undefined ? { publishAt: input.publishAt } : {}),
          ...(input.settingsByChannel && Object.keys(input.settingsByChannel).length > 0
            ? { settingsByChannel: input.settingsByChannel }
            : {}),
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => invalidate(vars.groupId),
  });
}

export function useCancelPost() {
  const invalidate = useInvalidatePost();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data, error } = await api.POST('/v1/posts/{groupId}/cancel', {
        params: { path: { groupId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, groupId) => invalidate(groupId),
  });
}

/** FAILED/NEEDS_REVIEW → SCHEDULED (com channelId, só aquele canal). */
export function useRetryPost() {
  const invalidate = useInvalidatePost();
  return useMutation({
    mutationFn: async (input: { groupId: string; channelId?: string }) => {
      const { data, error } = await api.POST('/v1/posts/{groupId}/retry', {
        params: { path: { groupId: input.groupId } },
        ...(input.channelId ? { body: { channelId: input.channelId } } : {}),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => invalidate(vars.groupId),
  });
}

// ---- link público de aprovação (DECISIONS v1.1 §12) ----

export function useApprovalLinkStatus(groupId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['approval-link', groupId],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/posts/{groupId}/approval-link', {
        params: { path: { groupId: groupId! } },
      });
      if (error) throw error;
      return data;
    },
    enabled: groupId !== null && enabled,
  });
}

export function useCreateApprovalLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; expiresInHours?: number }) => {
      const { data, error } = await api.POST('/v1/posts/{groupId}/approval-link', {
        params: { path: { groupId: input.groupId } },
        ...(input.expiresInHours ? { body: { expiresInHours: input.expiresInHours } } : {}),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) =>
      queryClient.invalidateQueries({ queryKey: ['approval-link', vars.groupId] }),
  });
}

export function useRevokeApprovalLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data, error } = await api.DELETE('/v1/posts/{groupId}/approval-link', {
        params: { path: { groupId } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['approval-link', groupId] });
      queryClient.invalidateQueries({ queryKey: ['publications'] });
    },
  });
}
