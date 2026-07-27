/**
 * Port de IA (SPEC_AI §2) — nenhum provedor nominal fora de infra/ai (CI: check:ai-providers).
 * Toda chamada passa pelo BudgetGuard (DECISIONS v1 §8): mecanismo obrigatório, números são config.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GeneratedText {
  text: string;
  usage: TokenUsage;
}

export interface AiProvider {
  generateText(req: {
    system: string;
    prompt: string;
    maxTokens: number;
    temperature?: number;
  }): Promise<GeneratedText>;
  /**
   * Descrever uma imagem é capacidade OPCIONAL do adapter (depende do modelo configurado ver
   * imagem). Ausente = o caso de uso recusa com `ai.capability_unavailable` em vez de inventar
   * descrição a partir do nome do arquivo.
   */
  describeImage?(req: {
    imageUrl: string;
    mimeType: string;
    system: string;
    prompt: string;
    maxTokens: number;
  }): Promise<GeneratedText>;
  generateImage?(req: {
    prompt: string;
    size: '1024x1024' | '1792x1024' | '1024x1792';
  }): Promise<{ url: string }>;
  moderate?(text: string): Promise<{ flagged: boolean; categories: string[] }>;
}

/** Saldo da franquia da org no período corrente — alimenta o `/v1/capabilities`. */
export interface AiBalance {
  /** franquia do plano no período (0 = plano sem IA) */
  granted: number;
  /** já consumido e confirmado */
  used: number;
  /** reservado por gerações em voo */
  reserved: number;
  /** `granted - used - reserved`, nunca negativo */
  remaining: number;
  periodEnd: Date;
  /** false = self-hosted: contabiliza para telemetria mas nunca recusa */
  enforced: boolean;
}

export interface BudgetGuard {
  /** Recusa com ai.budget_exceeded quando o orçamento da org/período estoura — nunca degrada silenciosamente. */
  reserve(orgId: string, operation: string, estimatedCredits: number): Promise<{ grantId: string }>;
  commit(grantId: string, actual: { credits: number; usage?: TokenUsage }): Promise<void>;
  release(grantId: string): Promise<void>;
  balance(orgId: string): Promise<AiBalance>;
}
