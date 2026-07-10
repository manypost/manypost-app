/** Eventos de webhook de saída (SPEC_API_MCP §4) — extension point do premium (SPEC_ARCHITECTURE §5). */
export const WebhookEvents = {
  PostScheduled: 'post.scheduled',
  PostPublished: 'post.published',
  PostFailed: 'post.failed',
  ChannelRefreshRequired: 'channel.refresh_required',
  ChannelDisconnected: 'channel.disconnected',
  MentionReceived: 'mention.received', // fase 2
} as const;

export type WebhookEvent = (typeof WebhookEvents)[keyof typeof WebhookEvents];

export interface WebhookEnvelope<T = unknown> {
  id: string;
  event: WebhookEvent;
  orgId: string;
  createdAt: string; // ISO
  data: T;
}
