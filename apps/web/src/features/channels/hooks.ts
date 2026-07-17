'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/** fetchers exportados p/ uso imperativo via queryClient (ex.: duplicar post) */
export async function fetchProviders() {
  const { data, error } = await api.GET('/v1/channels/providers');
  if (error) throw error;
  return data;
}

export async function fetchChannels() {
  const { data, error } = await api.GET('/v1/channels');
  if (error) throw error;
  return data;
}

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: fetchProviders,
    staleTime: Number.POSITIVE_INFINITY, // catálogo muda só com env da instalação
  });
}

export function useChannels() {
  return useQuery({ queryKey: ['channels'], queryFn: fetchChannels });
}

/**
 * POST /v1/channels/connect tem dois sucessos: 201 = canal conectado direto
 * (providers de credenciais); 200 = `{ url }` de autorização OAuth — quem
 * chama decide abrir o popup e invalidar depois (oauth-popup.ts).
 */
export function useConnectChannel() {
  return useMutation({
    mutationFn: async (input: { provider: string; fields?: Record<string, unknown> }) => {
      const { data, error } = await api.POST('/v1/channels/connect', {
        body: { provider: input.provider, ...(input.fields ? { fields: input.fields } : {}) },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidateChannels() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['channels'] });
}

export function useDisconnectChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE('/v1/channels/{id}', { params: { path: { id } } });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channels'] }),
  });
}
