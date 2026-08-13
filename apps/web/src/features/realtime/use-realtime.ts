'use client';

import { useClerk } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { chavesInvalidadasPor, EVENTOS_SSE } from './invalidations';
import { expireBrowserSession, realtimeSessionAction } from './realtime-session';

/**
 * SSE da UI (SPEC_FRONTEND §4): `GET /v1/events` só "cutuca" — todo evento
 * vira invalidação de query (o polling continua como fallback; perder evento
 * não perde dado — STATUS §3.13). EventSource não aceita header customizado,
 * então a API verifica o cookie Clerk `__session` nessa conexão same-origin.
 *
 * Antes de (re)abrir o stream fazemos um GET autenticado pelo cliente gerado.
 */
export function useRealtime() {
  const clerk = useClerk();
  const queryClient = useQueryClient();
  const t = useTranslations('realtime');
  // handler estável p/ o efeito não religar o stream a cada render
  const handler = useRef<(event: string, payload: unknown) => void>(() => {});

  handler.current = (event, payload) => {
    const data = payload as { channelName?: string; releaseUrl?: string } | undefined;

    // o que invalidar é dado (invalidations.ts) e é testado lá; aqui fica só o aviso à pessoa
    for (const queryKey of chavesInvalidadasPor(event)) {
      queryClient.invalidateQueries({ queryKey });
    }

    if (event === 'post.published') toast.success(t('published'));
    else if (event === 'post.failed') toast.error(t('failed'));
    else if (event === 'channel.refresh_required') {
      toast.warning(t('refreshRequired', { name: data?.channelName ?? '' }));
    }
  };

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const open = async () => {
      // renova o cookie de acesso se preciso (refresh-em-401 do cliente)
      const session = await api.GET('/v1/auth/me').catch(() => null);
      if (closed) return;
      const sessionAction = realtimeSessionAction(session?.response);
      if (sessionAction === 'expire') {
        closed = true;
        await expireBrowserSession({
          logout: () => clerk.signOut(),
          navigate: (path) => window.location.replace(path),
        });
        return;
      }
      if (sessionAction === 'retry') {
        retry = setTimeout(open, 15_000);
        return;
      }
      source = new EventSource('/v1/events');
      for (const name of EVENTOS_SSE) {
        source.addEventListener(name, (e) => {
          let payload: unknown;
          try {
            payload = JSON.parse((e as MessageEvent).data);
          } catch {
            payload = undefined;
          }
          handler.current(name, payload);
        });
      }
      source.onerror = () => {
        // reconexão manual com respiro (o retry nativo martela em 401)
        source?.close();
        if (!closed) retry = setTimeout(open, 15_000);
      };
    };
    void open();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, [clerk]);
}
