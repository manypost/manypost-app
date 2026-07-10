/**
 * Port de IA (SPEC_AI §2) — nenhum provedor nominal fora de infra/ai (CI: check:ai-providers).
 * Toda chamada passa pelo BudgetGuard (DECISIONS v1 §8): mecanismo obrigatório, números são config.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  generateText(req: {
    system: string;
    prompt: string;
    maxTokens: number;
    temperature?: number;
  }): Promise<{ text: string; usage: TokenUsage }>;
  generateImage?(req: {
    prompt: string;
    size: '1024x1024' | '1792x1024' | '1024x1792';
  }): Promise<{ url: string }>;
  moderate?(text: string): Promise<{ flagged: boolean; categories: string[] }>;
}

export interface BudgetGuard {
  /** Recusa com ai.budget_exceeded quando o orçamento da org/período estoura — nunca degrada silenciosamente. */
  reserve(orgId: string, operation: string, estimatedCredits: number): Promise<{ grantId: string }>;
  commit(grantId: string, actual: { credits: number; usage?: TokenUsage }): Promise<void>;
  release(grantId: string): Promise<void>;
}
