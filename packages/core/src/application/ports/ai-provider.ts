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
  /**
   * Gerar imagem é capacidade OPCIONAL do adapter, como `describeImage`. Ausente = a rota recusa
   * com `ai.capability_unavailable` e o `/v1/capabilities` reporta `canGenerateImages: false`, o
   * que faz a interface esconder a ação em vez de oferecer uma que falharia.
   *
   * A forma pedida é **proporção**, nunca resolução. Duas razões:
   *
   * 1. Uma lista de resoluções neste port seria o catálogo de UM fornecedor dentro do contrato
   *    agnóstico — o mesmo acoplamento que a regra 4 do `CLAUDE.md` proíbe, de roupa nova.
   * 2. Rede social nenhuma pensa em pixel: pensa em proporção (1:1 e 4:5 no feed do Instagram,
   *    9:16 em stories/reels, 16:9 no YouTube, 1.91:1 em prévia de link). A tradução
   *    proporção→dimensão vive dentro de cada adapter, o único lugar autorizado a conhecer o
   *    vocabulário do fornecedor.
   *
   * Devolve **bytes**, não URL. URL de provedor expira em horas, e guardá-la colocaria mídia com
   * prazo dentro de um post agendado para a semana que vem; além disso, baixar uma URL que o
   * provedor escolheu é exatamente a classe de requisição que a onda de anti-SSRF endureceu.
   */
  generateImage?(req: {
    prompt: string;
    aspect: ImageAspect;
    /** o adapter traduz para o que o fornecedor entende; o core nunca vê pixel */
    quality?: 'draft' | 'standard';
    signal?: AbortSignal;
  }): Promise<GeneratedImage>;
  moderate?(text: string): Promise<{ flagged: boolean; categories: string[] }>;
}

/**
 * Proporções que as redes realmente usam. Conjunto FECHADO de propósito: cada valor aqui é uma
 * forma que alguma rede aceita, e não um número que um fornecedor oferece.
 */
export const IMAGE_ASPECTS = ['1:1', '4:5', '9:16', '16:9', '1.91:1'] as const;
export type ImageAspect = (typeof IMAGE_ASPECTS)[number];

export const isImageAspect = (v: string): v is ImageAspect =>
  (IMAGE_ASPECTS as readonly string[]).includes(v);

export interface GeneratedImage {
  bytes: Uint8Array;
  /** declarado pelo provedor — o caso de uso NÃO confia nisto: valida por magic bytes */
  mime: string;
  width: number;
  height: number;
  /** prompt que o provedor efetivamente usou, quando ele reescreve — vai para a proveniência */
  revisedPrompt?: string;
  usage?: TokenUsage;
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
