/**
 * Adapter do protocolo de *messages* — o outro dialeto de uso amplo. Difere do de
 * chat-completions em três pontos que importam: o system vai num campo próprio (não como
 * mensagem), a credencial vai num header dedicado com versão de API, e a imagem vai por
 * conteúdo embutido em base64 em vez de URL.
 */
import type { AiProvider, GeneratedText } from '../../application/ports/ai-provider';
import {
  authHeaders,
  cappedTokens,
  invalidResponse,
  postJson,
  providerFailed,
  truncatedByCap,
  type AiAdapterConfig,
  type FetchLike,
} from './shared';

/** versão do dialeto que este adapter fala — fixa no código, não é configuração do operador */
const API_VERSION = '2023-06-01';

type MessagesReply = {
  content?: { type?: string; text?: unknown }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

const readReply = (raw: unknown, cap: number): GeneratedText => {
  const reply = raw as MessagesReply;
  // cortado pelo teto: mesmo raciocínio do outro dialeto — não devolver como se estivesse pronto
  if (reply.stop_reason === 'max_tokens') throw truncatedByCap(cap);
  const text = reply.content
    ?.filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim();
  if (!text) throw invalidResponse();
  return {
    text,
    usage: {
      inputTokens: reply.usage?.input_tokens ?? 0,
      outputTokens: reply.usage?.output_tokens ?? 0,
    },
  };
};

export function makeMessagesProvider(
  config: AiAdapterConfig,
  fetchImpl: FetchLike = fetch,
): AiProvider {
  const call = async (
    system: string,
    blocks: Block[],
    maxTokens: number,
    temperature?: number,
  ): Promise<GeneratedText> => {
    const cap = cappedTokens(config, maxTokens);
    return readReply(
      await postJson(
        config,
        fetchImpl,
        'v1/messages',
        {
          model: config.model,
          system,
          messages: [{ role: 'user', content: blocks }],
          max_tokens: cap,
          ...(temperature === undefined ? {} : { temperature }),
        },
        {
          'anthropic-version': API_VERSION,
          ...authHeaders(config.apiKey, (key) => ({ 'x-api-key': key })),
        },
      ),
      cap,
    );
  };

  return {
    generateText: ({ system, prompt, maxTokens, temperature }) =>
      call(system, [{ type: 'text', text: prompt }], maxTokens, temperature),

    // Este dialeto não aceita URL de imagem: os bytes vão embutidos. Baixamos da nossa própria
    // mídia pública — o mesmo endereço que já entregamos às redes — e nunca de URL do usuário.
    describeImage: async ({ imageUrl, mimeType, system, prompt, maxTokens }) => {
      const response = await fetchImpl(imageUrl, {
        signal: AbortSignal.timeout(config.timeoutMs),
      }).catch(() => null);
      if (!response?.ok) throw providerFailed('mídia não pôde ser lida', true);
      const data = Buffer.from(await response.arrayBuffer()).toString('base64');
      return call(
        system,
        [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data } },
          { type: 'text', text: prompt },
        ],
        maxTokens,
      );
    },
  };
}
