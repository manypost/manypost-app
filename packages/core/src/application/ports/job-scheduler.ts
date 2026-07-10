/**
 * Port de fila (SPEC_QUEUE_PUBLISHING §2). Adapter padrão: pg-boss (núcleo).
 * O gerenciado pode plugar Temporal Cloud na v2+ sem tocar o domínio (DECISIONS v1 §2)
 * — todo adapter deve passar o mesmo teste de contrato.
 */
export interface EnqueueOptions {
  /** dedup: 1 job ativo por chave (equivalente funcional do workflowId TERMINATE_EXISTING do Postiz) */
  singletonKey?: string;
  startAfter?: Date;
  retryLimit?: number;
  retryBackoffSec?: number;
}

export interface JobScheduler {
  enqueue<T extends object>(queue: string, payload: T, opts?: EnqueueOptions): Promise<string>;
  cancelBySingletonKey(queue: string, singletonKey: string): Promise<void>;
  /** cron jobs de sistema: recover-scan, refresh-token, analytics-cache */
  schedule(queue: string, cron: string, payload?: object): Promise<void>;
}
