import { z } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import type { Container } from '../../container';
import { SSE_KEEPALIVE_MS } from '../server-options';
import { requireAuth } from '../middleware/auth';
import { AUTH_SECURITY, createApp, errorResponses } from '../openapi';

/**
 * SSE `GET /v1/events` (SPEC_FRONTEND §4): a UI invalida queries quando o estado
 * de publicação muda. Eventos nomeados = tipo do evento de domínio
 * (post.scheduled/post.published/post.failed/channel.refresh_required/notification.created).
 * Sem Redis o stream fica só com keepalive — o fallback é o polling de 30s da UI.
 */
export function eventRoutes(ctn: Container) {
  const app = createApp();
  app.use('*', requireAuth({ signer: ctn.signer, verifyApiKey: ctn.auth.verifyApiKey }));

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/',
    tags: ['events'],
    security: AUTH_SECURITY,
    summary: 'Stream SSE de eventos em tempo real',
    description:
      'Eventos nomeados: post.scheduled, post.published, post.failed, channel.refresh_required, notification.created (+ hello no handshake e ping a cada 25s). Sem Redis o stream fica só com keepalive — a UI cai no polling.',
    responses: {
      200: {
        description: 'stream text/event-stream',
        content: { 'text/event-stream': { schema: z.string() } },
      },
      ...errorResponses(401),
    },
  });
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
        await stream.sleep(SSE_KEEPALIVE_MS);
        if (stream.aborted || stream.closed) break;
        await stream.writeSSE({ event: 'ping', data: String(Date.now()) });
      }
      await unsubscribe?.();
    });
  });

  return app;
}
