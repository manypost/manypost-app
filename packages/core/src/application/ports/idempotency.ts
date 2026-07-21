/**
 * Store de idempotência para POSTs de mutação da API pública (SPEC_API_MCP §3:
 * "Idempotency-Key em todos os POST de mutação"). O cliente manda `Idempotency-Key`;
 * a 2ª chamada com a MESMA chave e o MESMO corpo devolve a resposta original em vez de
 * repetir o efeito (ex.: retry de POST /posts não cria dois grupos). Adapter: packages/queue (Redis).
 *
 * Sem Redis o store é opcional/no-op (falha aberta, alinhado à postura "Redis é descartável"
 * do rate-limiter/realtime): o handler roda normalmente — perde-se só a dedupe, nunca a corretude.
 */
export type IdempotencyClaim =
  /** a chave é sua — processe o handler e depois chame `store` */
  | { outcome: 'claimed' }
  /** já concluída antes com o mesmo corpo — devolva `response` sem reprocessar */
  | { outcome: 'replay'; response: StoredResponse }
  /** em voo por outra requisição idêntica (ainda sem resposta) — responda 409 */
  | { outcome: 'pending' }
  /** mesma chave, corpo diferente — uso indevido da chave — responda 409 */
  | { outcome: 'conflict' };

export interface StoredResponse {
  status: number;
  /** corpo serializado (JSON string) da resposta original */
  body: string;
}

export interface IdempotencyStore {
  /**
   * Reivindica a chave para esta requisição. `fingerprint` = hash do corpo (mesma chave +
   * corpo diferente = conflito). `ttlSec` = validade da reserva/resposta guardada.
   */
  claim(key: string, fingerprint: string, ttlSec: number): Promise<IdempotencyClaim>;
  /** Guarda a resposta concluída para replays futuros dentro do TTL. */
  store(key: string, response: StoredResponse, ttlSec: number): Promise<void>;
  /** Libera uma reserva `pending` (handler falhou) para permitir nova tentativa. */
  release(key: string): Promise<void>;
}
