import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { ErrorCodes, type WebhookEnvelope, type WebhookEvent } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { CryptoService } from '../ports/crypto';
import type { EventPublisher, WebhookRecord, WebhookRepository } from '../ports/events';
import type { JobScheduler } from '../ports/job-scheduler';
import type { RealtimePublisher } from '../ports/realtime';
import { randomToken } from '../tokens';

export const WEBHOOK_QUEUE = 'webhook-delivery';
const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 5, 25, 120, 360]; // minutos

const webhookAad = (orgId: string) => `webhook:${orgId}`;

const sanitize = (w: WebhookRecord) => ({
  id: w.id,
  name: w.name,
  url: w.url,
  events: w.events,
  channelIds: w.channelIds,
  disabledAt: w.disabledAt,
  createdAt: w.createdAt,
});

/** Bloqueia URLs que resolvem para IP privado (anti-SSRF — SPEC_API_MCP §3). */
export async function assertPublicUrl(rawUrl: string, allowPrivate = false, what = 'webhook') {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new DomainError(ErrorCodes.PostInvalidSettings, `URL de ${what} deve ser http(s)`);
  }
  if (allowPrivate) return;
  const addrs = await lookup(url.hostname, { all: true }).catch(() => []);
  const isPrivate = (ip: string) =>
    /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1|f[cd]|fe80)/i.test(ip);
  if (addrs.length === 0 || addrs.some((a) => isPrivate(a.address))) {
    throw new DomainError(ErrorCodes.PostInvalidSettings, `URL de ${what} não permitida (rede privada)`);
  }
}

export interface WebhookDeps {
  webhooks: WebhookRepository;
  crypto: CryptoService;
  allowPrivateUrls?: boolean;
}

export const makeCreateWebhook = (deps: WebhookDeps) =>
  async (input: { orgId: string; name: string; url: string; events: string[]; channelIds?: string[] }) => {
    await assertPublicUrl(input.url, deps.allowPrivateUrls);
    const secret = `whsec_${randomToken(24)}`;
    const enc = await deps.crypto.encrypt(secret, webhookAad(input.orgId));
    const record = await deps.webhooks.create({
      orgId: input.orgId,
      name: input.name,
      url: input.url,
      events: input.events,
      channelIds: input.channelIds ?? [],
      secretEnc: enc.ciphertext,
      secretKeyVersion: enc.keyVersion,
    });
    // o secret em claro só aparece aqui — o receptor valida a assinatura com ele
    return { secret, webhook: sanitize(record) };
  };

export const makeListWebhooks = (deps: Pick<WebhookDeps, 'webhooks'>) =>
  async (orgId: string) => (await deps.webhooks.list(orgId)).map(sanitize);

export const makeDeleteWebhook = (deps: Pick<WebhookDeps, 'webhooks'>) =>
  async (orgId: string, id: string) => {
    if (!(await deps.webhooks.softDelete(orgId, id))) {
      throw new DomainError(ErrorCodes.NotFound, 'webhook não encontrado');
    }
  };

/** EventPublisher: 1 delivery por webhook inscrito + job de entrega + eco no bus realtime (SSE). */
export const makeEmitEvent = (deps: {
  webhooks: WebhookRepository;
  scheduler: JobScheduler;
  realtime?: RealtimePublisher;
  log?: (level: string, msg: string, data?: object) => void;
}): EventPublisher => ({
  async emit(e) {
    // todo evento de domínio vai ao bus da UI, inscrito ou não em webhooks (melhor esforço)
    await deps.realtime
      ?.publish(e.orgId, { type: e.event, data: e.data })
      .catch((err) => deps.log?.('warn', 'realtime publish falhou', { err: String(err) }));
    const targets = await deps.webhooks.findForEvent(e.orgId, e.event, e.channelId);
    for (const w of targets) {
      const envelope: WebhookEnvelope = {
        id: randomToken(12),
        event: e.event as WebhookEvent,
        orgId: e.orgId,
        createdAt: new Date().toISOString(),
        data: e.data,
      };
      const { id } = await deps.webhooks.createDelivery({
        webhookId: w.id,
        event: e.event,
        payload: envelope,
      });
      await deps.scheduler
        .enqueue(WEBHOOK_QUEUE, { deliveryId: id }, { singletonKey: id })
        .catch((err) => deps.log?.('error', 'enqueue webhook falhou', { id, err: String(err) }));
    }
  },
});

export const signWebhookBody = (secret: string, timestamp: number, body: string) =>
  `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;

export const makeDeliverWebhook = (deps: WebhookDeps & {
  scheduler: JobScheduler;
  fetchFn?: typeof fetch;
  log?: (level: string, msg: string, data?: object) => void;
}) =>
  async (deliveryId: string): Promise<void> => {
    const found = await deps.webhooks.getDelivery(deliveryId);
    if (!found || found.delivery.status === 'DELIVERED' || found.delivery.status === 'FAILED') return;
    const { delivery, webhook } = found;
    if (webhook.disabledAt) {
      return deps.webhooks.markDelivery(deliveryId, {
        status: 'FAILED',
        attempts: delivery.attempts,
        lastError: 'webhook desativado',
      });
    }

    const attempts = delivery.attempts + 1;
    const body = JSON.stringify(delivery.payload);
    try {
      await assertPublicUrl(webhook.url, deps.allowPrivateUrls);
      const secret = await deps.crypto.decrypt(
        webhook.secretEnc,
        webhookAad(webhook.orgId),
        webhook.secretKeyVersion,
      );
      const ts = Math.floor(Date.now() / 1000);
      const res = await (deps.fetchFn ?? fetch)(webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'manypost-webhooks',
          'x-manypost-event': delivery.event,
          'x-manypost-signature': signWebhookBody(secret, ts, body),
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status >= 200 && res.status < 300) {
        return deps.webhooks.markDelivery(deliveryId, { status: 'DELIVERED', attempts });
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempts >= MAX_ATTEMPTS) {
        return deps.webhooks.markDelivery(deliveryId, {
          status: 'FAILED',
          attempts,
          lastError: String(err).slice(0, 500),
        });
      }
      const nextRetryAt = new Date(Date.now() + BACKOFF_MIN[attempts - 1]! * 60_000);
      await deps.webhooks.markDelivery(deliveryId, {
        status: 'PENDING',
        attempts,
        nextRetryAt,
        lastError: String(err).slice(0, 500),
      });
      await deps.scheduler.enqueue(
        WEBHOOK_QUEUE,
        { deliveryId },
        { startAfter: nextRetryAt, singletonKey: `${deliveryId}:a${attempts}` },
      );
    }
  };
