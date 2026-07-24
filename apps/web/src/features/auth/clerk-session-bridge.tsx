'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setClerkTokenProvider } from '@/lib/api/clerk-session-recovery';

export function ClerkSessionBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setClerkTokenProvider(getToken);
    return () => setClerkTokenProvider(null);
  }, [getToken]);
  return null;
}
