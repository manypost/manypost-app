export interface RateWindowSpec {
  key: string;
  limit: number;
  windowSec: number;
}

/** Token bucket/janela em Redis (SPEC_QUEUE §6). Adapter: packages/queue. */
export interface RateLimiter {
  /** all-or-nothing entre janelas; negado retorna quando tentar de novo */
  acquire(windows: RateWindowSpec[]): Promise<{ ok: true } | { ok: false; retryAfterSec: number }>;
}
