'use client';

import { useClerk } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import { logoutClerkSession } from './auth-flow';

// 1 recurso = 1 hook = 1 query key (SPEC_FRONTEND §4)

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const data = unwrap(await api.GET('/v1/auth/me'));
      return data;
    },
  });
}

export function useLogout() {
  const clerk = useClerk();
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      logoutClerkSession({
        logoutClerk: async () => {
          await clerk.signOut();
        },
      }),
    onSettled: () => {
      queryClient.clear();
      router.replace('/login');
      router.refresh();
    },
  });
}
