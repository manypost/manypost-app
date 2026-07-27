/**
 * Base compartilhada dos adapters de IA. Este diretório é o ÚNICO lugar do monorepo onde um
 * fornecedor de modelo pode ser nomeado (SPEC_AI §2, CI: `bun run check:ai-providers`) — e mesmo
 * aqui os arquivos são nomeados pelo PROTOCOLO HTTP que falam, não por quem o publicou.
 *
 * Regra de vazamento: nada que venha do upstream (corpo, endpoint, credencial) entra no
 * DomainError. O operador tem o log da instalação; o usuário final recebe "o provedor falhou".
 */
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';

export type AiAdapterConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  /**
   * Modelo de imagem, quando o de texto não desenha. Opcional: sem ele, a geração de imagem usa
   * `model`. Existe porque um operador não deveria precisar de duas instalações só porque o modelo
   * de texto que ele escolheu não produz imagem.
   */
  imageModel?: string;
};

/** o mesmo `fetch` global, injetável para os testes não tocarem a rede */
export type FetchLike = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const providerFailed = (motivo: string, retryable: boolean, extra = {}): DomainError =>
  new DomainError(
    ErrorCodes.AiProviderFailed,
    `O provedor de IA não atendeu (${motivo}). Tente de novo em instantes.`,
    { retryable, ...extra },
  );

export const invalidResponse = (): DomainError =>
  new DomainError(
    ErrorCodes.AiInvalidResponse,
    'O modelo respondeu, mas a resposta não pôde ser usada.',
    { retryable: true },
  );

/**
 * Resposta interrompida pelo teto de tokens.
 *
 * NÃO pode ser devolvida como se estivesse pronta: o texto termina no meio de uma palavra, e o
 * `shortenTo` do caso de uso a marcaria como "encurtada para caber no canal" — que é outra
 * coisa, e esconderia um problema de configuração atrás de um comportamento normal.
 *
 * O caso mais comum é **modelo de raciocínio**: ele gasta tokens de saída pensando antes de
 * escrever, então o teto que basta para um modelo comum o corta antes da primeira letra da
 * resposta. Por isso a mensagem aponta a variável, em vez de dizer só "falhou".
 */
export const truncatedByCap = (cap: number): DomainError =>
  new DomainError(
    ErrorCodes.AiInvalidResponse,
    `A resposta do modelo foi cortada no teto de ${cap} tokens de saída. ` +
      'Se o modelo configurado for de raciocínio, ele consome tokens pensando antes de escrever — ' +
      'aumente AI_MAX_OUTPUT_TOKENS.',
    { retryable: false, cap },
  );

/** 4xx é configuração/pedido (não adianta repetir); 408/429 e 5xx são momentâneos. */
export const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

export const joinUrl = (base: string, path: string): string =>
  `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/**
 * POST JSON com teto de tempo. Devolve o corpo já parseado; qualquer desfecho que não seja
 * 2xx com JSON vira DomainError classificado — o chamador nunca vê Response nem corpo cru.
 */
export async function postJson(
  config: AiAdapterConfig,
  fetchImpl: FetchLike,
  path: string,
  body: unknown,
  headers: Record<string, string>,
  /** cancelamento do chamador — soma-se ao teto de tempo da instalação, nunca o substitui */
  signal?: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetchImpl(joinUrl(config.baseUrl, path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      // o corpo do upstream pode ecoar a chave enviada — ele NÃO entra no erro
      throw providerFailed(`status ${response.status}`, isRetryableStatus(response.status), {
        status: response.status,
      });
    }
    try {
      return await response.json();
    } catch {
      throw invalidResponse();
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw providerFailed('tempo esgotado', true, { timeout: true });
    }
    // falha de transporte (DNS, TLS, conexão recusada): repetível, e a mensagem não sai daqui
    throw providerFailed('falha de conexão', true);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Teto de saída enviado ao provedor: **o da instalação**, não o pedido pelo caso de uso.
 *
 * Parece contraintuitivo, e a razão é concreta. `max_tokens` é TETO, não alvo: um modelo comum
 * para sozinho quando termina a resposta, então mandar um teto folgado não gasta nada a mais.
 * Já um modelo de RACIOCÍNIO gasta tokens de saída pensando antes de escrever — com um teto
 * apertado por requisição, ele é cortado no meio da palavra (verificado contra provedor real).
 *
 * E apertar não comprava nada: o tamanho do texto por canal é garantido **depois** do modelo,
 * de forma determinística (`shortenTo`, design D7). O `requested` do chamador segue no contrato
 * como declaração de necessidade — quem limita o custo é o operador, por `AI_MAX_OUTPUT_TOKENS`.
 */
export const cappedTokens = (config: AiAdapterConfig, requested: number): number => {
  void requested;
  return Math.max(1, config.maxOutputTokens);
};

/**
 * Base64 → bytes, sem confiar na entrada.
 *
 * `atob` estoura com caractere fora do alfabeto, e um provedor devolvendo lixo é um caso real
 * (proxy que injeta HTML de erro num corpo JSON, por exemplo). A falha vira `ai.invalid_response`,
 * que o `withBudget` trata como erro NOSSO e devolve a franquia — cobrar por lixo seria a troca
 * errada.
 */
export function decodeBase64(b64: string): Uint8Array {
  try {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.byteLength === 0) throw new Error('vazio');
    return bytes;
  } catch {
    throw invalidResponse();
  }
}

export const authHeaders = (
  apiKey: string | undefined,
  build: (key: string) => Record<string, string>,
): Record<string, string> => (apiKey ? build(apiKey) : {});
