'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';

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
      const data = unwrap(await api.GET('/v1/api-keys'));
      return data;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; scopes: ApiKeyScope[] }) => {
      const data = unwrap(await api.POST('/v1/api-keys', { body: input }));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await api.DELETE('/v1/api-keys/{id}', { params: { path: { id } } }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const data = unwrap(await api.GET('/v1/webhooks'));
      return data;
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; url: string; events: WebhookEvent[]; channelIds?: string[] }) => {
      const data = unwrap(await api.POST('/v1/webhooks', { body: input }));
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await api.DELETE('/v1/webhooks/{id}', { params: { path: { id } } }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}
