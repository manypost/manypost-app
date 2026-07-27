/**
 * Persistência da franquia de IA (SPEC_AI §4 / DECISIONS v1 §8).
 *
 * O port é deliberadamente estreito: a decisão de conceder tem de caber numa única instrução
 * condicional no banco, porque é o bloqueio de linha do Postgres — não código de aplicação —
 * que impede duas gerações simultâneas de furarem a mesma franquia (SPEC_AI §5.3). Qualquer
 * assinatura que devolvesse "quanto sobra" para o caso de uso decidir depois reabriria a corrida.
 *
 * `granted` e o período viajam em cada chamada porque quem os conhece é o catálogo de planos,
 * não o banco: o balde do período é aberto sob demanda com a franquia que o plano concede AGORA.
 */
export interface AiCreditsRepository {
  /**
   * Abre o balde do período se faltar, devolve reservas com lease vencida e tenta reservar —
   * tudo numa transação. `null` = franquia insuficiente (o chamador levanta `ai.budget_exceeded`).
   */
  reserve(input: {
    orgId: string;
    operation: string;
    credits: number;
    granted: number;
    periodStart: Date;
    periodEnd: Date;
    leaseSec: number;
  }): Promise<{ grantId: string } | null>;

  /**
   * Confirma o consumo real. Transição condicional saindo de RESERVED: repetir não consome de
   * novo, e uma reserva já recuperada por lease vencida não volta a debitar.
   */
  commit(
    grantId: string,
    actual: { credits: number; inputTokens?: number; outputTokens?: number },
  ): Promise<void>;

  /** Devolve a reserva à franquia. Idempotente pelo mesmo motivo do `commit`. */
  release(grantId: string): Promise<void>;

  /** Saldo do período corrente (abre o balde se faltar) — alimenta o `/v1/capabilities`. */
  balance(input: {
    orgId: string;
    granted: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<{ granted: number; used: number; reserved: number; periodEnd: Date }>;
}
