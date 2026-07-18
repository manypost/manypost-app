/**
 * Coletor de métricas de domínio (SPEC_INFRA §4). O core só conhece esta interface;
 * a implementação Prometheus (registro + exposição em /metrics) vive em apps/api/infra.
 * Todos os métodos são best-effort e NUNCA lançam — métrica não pode derrubar publicação.
 */
export interface MetricsSink {
  /** `publishing_publications_total{provider,state}` — state ∈ published|failed (resultado final) */
  onPublicationResult(provider: string, state: 'published' | 'failed'): void;
  /** `publishing_retry_total{class}` — retry de negócio (transient/refresh) re-agendado */
  onRetry(errorClass: string): void;
  /** `publishing_recovered_total{kind}` — kind ∈ due|stuck (scanner do §8) */
  onRecovered(kind: 'due' | 'stuck', count: number): void;
  /** `rate_limit_denied_total{provider,reason}` — reason ∈ window|concurrency */
  onRateLimitDenied(provider: string, reason: 'window' | 'concurrency'): void;
}
