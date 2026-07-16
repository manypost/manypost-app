'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';

// 1 recurso = 1 hook = 1 query key (SPEC_FRONTEND §4)

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/auth/me');
      if (error) throw error;
      return data;
    },
  });
}

export function useSocialProviders() {
  return useQuery({
    queryKey: ['social-providers'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/auth/social');
      if (error) throw error;
      return data;
    },
    staleTime: Number.POSITIVE_INFINITY, // catálogo estático por instalação
  });
}

export function useLogin(nextPath?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data, error } = await api.POST('/v1/auth/login', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace(nextPath ?? '/calendario');
      router.refresh();
    },
  });
}

export function useRegister() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      email: string;
      password: string;
      name: string;
      orgName?: string;
    }) => {
      const { data, error } = await api.POST('/v1/auth/register', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.clear();
      // onboarding: conta nova vai direto conectar o 1º canal (SPEC_FRONTEND §2)
      router.replace('/conexoes');
      router.refresh();
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.POST('/v1/auth/logout', {});
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    },
  });
}
