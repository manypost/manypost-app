'use client';

import { useRealtime } from './use-realtime';

/** Montado uma vez no shell autenticado — liga o SSE à invalidação de queries. */
export function RealtimeListener() {
  useRealtime();
  return null;
}
