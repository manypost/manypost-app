'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type ApiKeyScope =
  | 'posts:read'
  | 'posts:write'
  | 'channels:read'
  | 'channels:write'
  | 'media:write'
  | 'analytics:read'
  | 'webhooks:manage'
  | 'mcp';

export type WebhookEvent =
  | 'post.scheduled'
  | 'post.published'
  | 'post.failed'
  | 'channel.refresh_required'
  | 'channel.disconnected'
  | 'mention.received';

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/api-keys');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; scopes: ApiKeyScope[] }) => {
      const { data, error } = await api.POST('/v1/api-keys', { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE('/v1/api-keys/{id}', { params: { path: { id } } });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/webhooks');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; url: string; events: WebhookEvent[]; channelIds?: string[] }) => {
      const { data, error } = await api.POST('/v1/webhooks', { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE('/v1/webhooks/{id}', { params: { path: { id } } });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}
