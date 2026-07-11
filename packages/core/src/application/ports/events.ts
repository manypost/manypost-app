import type { WebhookEvent } from '@manypost/contracts';

/** Eventos de domínio → webhooks de saída / premium (SPEC_ARCHITECTURE §5). */
export interface EventPublisher {
  emit(e: {
    orgId: string;
    event: WebhookEvent;
    channelId?: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export interface WebhookRecord {
  id: string;
  orgId: string;
  name: string;
  url: string;
  events: string[];
  channelIds: string[];
  secretEnc: Uint8Array;
  secretKeyVersion: number;
  disabledAt: Date | null;
  createdAt: Date;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  status: string;
  attempts: number;
}

export interface WebhookRepository {
  create(d: {
    orgId: string;
    name: string;
    url: string;
    events: string[];
    channelIds: string[];
    secretEnc: Uint8Array;
    secretKeyVersion: number;
  }): Promise<WebhookRecord>;
  list(orgId: string): Promise<WebhookRecord[]>;
  softDelete(orgId: string, id: string): Promise<boolean>;
  findForEvent(orgId: string, event: string, channelId?: string): Promise<WebhookRecord[]>;
  createDelivery(d: { webhookId: string; event: string; payload: unknown }): Promise<{ id: string }>;
  getDelivery(
    id: string,
  ): Promise<{ delivery: WebhookDeliveryRecord; webhook: WebhookRecord } | null>;
  markDelivery(
    id: string,
    d: { status: 'DELIVERED' | 'PENDING' | 'FAILED'; attempts: number; nextRetryAt?: Date; lastError?: string },
  ): Promise<void>;
}
