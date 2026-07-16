'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export function useMediaList() {
  return useQuery({
    queryKey: ['media'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/media', {
        params: { query: { limit: '200' } },
      });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Upload multipart pelo cliente gerado: o schema declara `file` como string
 * binária; o bodySerializer monta o FormData de verdade (o browser define o
 * boundary — nunca fixar Content-Type à mão).
 */
export function useUploadMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; alt?: string }) => {
      const { data, error } = await api.POST('/v1/media/upload', {
        body: { file: input.file as unknown as string, ...(input.alt ? { alt: input.alt } : {}) },
        bodySerializer: () => {
          const fd = new FormData();
          fd.append('file', input.file);
          if (input.alt) fd.append('alt', input.alt);
          return fd;
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function useImportMediaFromUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { url: string; alt?: string }) => {
      const { data, error } = await api.POST('/v1/media/from-url', {
        body: { url: input.url, ...(input.alt ? { alt: input.alt } : {}) },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function useUpdateMediaAlt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; alt: string | null }) => {
      const { error } = await api.PATCH('/v1/media/{id}', {
        params: { path: { id: input.id } },
        body: { alt: input.alt },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE('/v1/media/{id}', { params: { path: { id } } });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });
}
