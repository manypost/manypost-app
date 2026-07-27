/**
 * Adapter do protocolo de *chat completions* — o dialeto que gateways agregadores e runtimes
 * locais (self-host) implementam. Trocar de fornecedor é mudar `AI_BASE_URL`/`AI_MODEL`, não
 * código: nenhum caso de uso sabe que este arquivo existe.
 */
import type { AiProvider, GeneratedText } from '../../application/ports/ai-provider';
import {
  authHeaders,
  cappedTokens,
  invalidResponse,
  postJson,
  truncatedByCap,
  type AiAdapterConfig,
  type FetchLike,
} from './shared';

type ChatReply = {
  choices?: { message?: { content?: unknown }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** conteúdo de uma mensagem: texto puro ou partes (texto + imagem) */
type Content = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

const readReply = (raw: unknown, cap: number): GeneratedText => {
  const reply = raw as ChatReply;
  const escolha = reply.choices?.[0];
  // cortado pelo teto: nunca devolver como se estivesse pronto (o texto acaba no meio da palavra)
  if (escolha?.finish_reason === 'length') throw truncatedByCap(cap);
  const content = escolha?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') throw invalidResponse();
  return {
    text: content.trim(),
    usage: {
      inputTokens: reply.usage?.prompt_tokens ?? 0,
      outputTokens: reply.usage?.completion_tokens ?? 0,
    },
  };
};

export function makeChatCompletionsProvider(
  config: AiAdapterConfig,
  fetchImpl: FetchLike = fetch,
): AiProvider {
  const call = async (
    system: string,
    userContent: Content,
    maxTokens: number,
    temperature?: number,
  ): Promise<GeneratedText> => {
    const cap = cappedTokens(config, maxTokens);
    return readReply(
      await postJson(
        config,
        fetchImpl,
        'chat/completions',
        {
          model: config.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
          max_tokens: cap,
          ...(temperature === undefined ? {} : { temperature }),
        },
        authHeaders(config.apiKey, (key) => ({ authorization: `Bearer ${key}` })),
      ),
      cap,
    );
  };

  return {
    generateText: ({ system, prompt, maxTokens, temperature }) =>
      call(system, prompt, maxTokens, temperature),

    // A imagem vai por REFERÊNCIA (URL pública da nossa mídia), não por bytes: é o mesmo
    // caminho que a família Meta já usa para puxar mídia, e evita subir o arquivo duas vezes.
    describeImage: ({ imageUrl, system, prompt, maxTokens }) =>
      call(
        system,
        [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
        maxTokens,
      ),
  };
}
