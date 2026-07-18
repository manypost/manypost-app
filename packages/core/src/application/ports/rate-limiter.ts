export interface RateWindowSpec {
  key: string;
  limit: number;
  windowSec: number;
}

export type RateVerdict = { ok: true } | { ok: false; retryAfterSec: number };

/** Token bucket/janela + semáforo de concorrência em Redis (SPEC_QUEUE §6). Adapter: packages/queue. */
export interface RateLimiter {
  /** all-or-nothing entre janelas; negado retorna quando tentar de novo */
  acquire(windows: RateWindowSpec[]): Promise<RateVerdict>;
  /**
   * Semáforo de concorrência por provider (maxConcurrent): adquire 1 slot com um `token`
   * único; o slot fica ocupado até `releaseSlot` (chamado no fim da publicação) OU até
   * expirar por `staleSec` (worker que caiu no meio — o slot é reclamado). Negado = a
   * concorrência do provider está no teto; o job re-agenda sem consumir tentativa.
   * Opcional: sem implementação/sem Redis o semáforo é no-op (só as janelas atuam).
   */
  acquireSlot?(key: string, limit: number, token: string): Promise<RateVerdict>;
  /** libera o slot adquirido por `token` (idempotente; token inexistente = no-op) */
  releaseSlot?(key: string, token: string): Promise<void>;
}
