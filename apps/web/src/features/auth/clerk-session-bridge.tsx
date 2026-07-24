'use client';

import { useAuth } from '@clerk/nextjs';
import { useLayoutEffect } from 'react';
import { setClerkTokenProvider } from '@/lib/api/clerk-fetch';

export function ClerkSessionBridge() {
  const { getToken } = useAuth();
  useLayoutEffect(() => {
    setClerkTokenProvider(getToken);
    return () => setClerkTokenProvider(null);
  }, [getToken]);
  return null;
}
