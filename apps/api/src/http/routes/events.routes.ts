import { OpenAPIHono } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import type { Container } from '../../container';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

const KEEPALIVE_MS = 25_000; // proxies derrubam conexões ociosas antes dos 30s típicos

/**
 * SSE `GET /v1/events` (SPEC_FRONTEND §4): a UI invalida queries quando o estado
 * de publicação muda. Eventos nomeados = tipo do evento de domínio
 * (post.scheduled/post.published/post.failed/channel.refresh_required/notification.created).
 * Sem Redis o stream fica só com keepalive — o fallback é o polling de 30s da UI.
 */
export function eventRoutes(ctn: Container) {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.get('/', (c) => {
    const orgId = c.get('principal').orgId;
    const bus = ctn.runtime.realtime;
    return streamSSE(c, async (stream) => {
      // assina ANTES do hello: quem vê o handshake já não perde eventos
      const unsubscribe = bus
        ? await bus.subscribe(orgId, (e) => {
            void stream.writeSSE({ event: e.type, data: JSON.stringify(e.data) });
          })
        : undefined;
      await stream.writeSSE({
        event: 'hello',
        data: JSON.stringify({ realtime: Boolean(bus) }),
        retry: 5_000,
      });
      stream.onAbort(() => void unsubscribe?.());
      while (!stream.aborted && !stream.closed) {
        await stream.sleep(KEEPALIVE_MS);
        if (stream.aborted || stream.closed) break;
        await stream.writeSSE({ event: 'ping', data: String(Date.now()) });
      }
      await unsubscribe?.();
    });
  });

  return app;
}
