/**
 * Bus de eventos em tempo real para a UI (SSE /v1/events — SPEC_FRONTEND §4).
 * Semântica: melhor esforço (fire-and-forget) — a UI tem polling de fallback;
 * a fonte de verdade continua sendo o banco.
 */
export interface RealtimeEvent {
  /** ex.: post.scheduled | post.published | post.failed | notification.created */
  type: string;
  data: Record<string, unknown>;
}

export interface RealtimePublisher {
  publish(orgId: string, e: RealtimeEvent): Promise<void>;
}

export interface RealtimeSubscriber {
  /** entrega eventos da org até o unsubscribe retornado ser chamado */
  subscribe(orgId: string, onEvent: (e: RealtimeEvent) => void): Promise<() => Promise<void>>;
}
