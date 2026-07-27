/**
 * Adapter do protocolo de *chat completions* — o dialeto que gateways agregadores e runtimes
 * locais (self-host) implementam. Trocar de fornecedor é mudar `AI_BASE_URL`/`AI_MODEL`, não
 * código: nenhum caso de uso sabe que este arquivo existe.
 */
import type { AiProvider, GeneratedText, ImageAspect } from '../../application/ports/ai-provider';
import sharp from 'sharp';
import {
  authHeaders,
  cappedTokens,
  decodeBase64,
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

type ImageReply = { data?: { b64_json?: string; revised_prompt?: string }[] };

/**
 * Proporção → resolução deste dialeto. **Único lugar** do monorepo onde uma dimensão em pixel
 * aparece, e é aqui de propósito: o port fala em proporção para que trocar de fornecedor (que
 * oferece outras dimensões) não vaze para o contrato agnóstico.
 *
 * `4:5` e `1.91:1` não têm resolução própria neste dialeto — caem na mais próxima que ele aceita,
 * e o corte fino para a proporção exata é problema da rede, não nosso. Melhor uma aproximação
 * declarada aqui do que uma requisição recusada pelo fornecedor.
 */
const RESOLUCAO_POR_PROPORCAO: Record<
  ImageAspect,
  { size: string; width: number; height: number }
> = {
  '1:1': { size: '1024x1024', width: 1024, height: 1024 },
  '4:5': { size: '1024x1792', width: 1024, height: 1792 },
  '9:16': { size: '1024x1792', width: 1024, height: 1792 },
  '16:9': { size: '1792x1024', width: 1792, height: 1024 },
  '1.91:1': { size: '1792x1024', width: 1792, height: 1024 },
};

const UNIDADE_POR_PROPORCAO: Record<ImageAspect, readonly [width: number, height: number]> = {
  '1:1': [1, 1],
  '4:5': [4, 5],
  '9:16': [9, 16],
  '16:9': [16, 9],
  '1.91:1': [191, 100],
};

/**
 * Recorta a resposta nativa para o maior retângulo inteiro da proporção pedida.
 *
 * O provedor pode aceitar só três formas, mas o contrato do produto promete cinco. O recorte
 * acontece no adapter porque pixel é vocabulário do protocolo, não do caso de uso. Não ampliamos
 * a imagem e limitamos a descompressão a 8192² pixels para uma resposta hostil não consumir
 * memória sem limite.
 */
const cropToAspect = async (
  bytes: Uint8Array,
  aspect: ImageAspect,
): Promise<{ bytes: Uint8Array; width: number; height: number }> => {
  try {
    const input = sharp(bytes, { limitInputPixels: 8192 * 8192 });
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height) throw new Error('dimensões ausentes');

    const [unitWidth, unitHeight] = UNIDADE_POR_PROPORCAO[aspect];
    const scale = Math.min(
      Math.floor(metadata.width / unitWidth),
      Math.floor(metadata.height / unitHeight),
    );
    if (scale < 1) throw new Error('imagem menor que a unidade da proporção');

    const width = unitWidth * scale;
    const height = unitHeight * scale;
    let output = sharp(bytes, { limitInputPixels: 8192 * 8192 });
    if (width !== metadata.width || height !== metadata.height) {
      output = output.extract({
        left: Math.floor((metadata.width - width) / 2),
        top: Math.floor((metadata.height - height) / 2),
        width,
        height,
      });
    }

    // O port declara image/png; providers compatíveis podem responder JPEG/WebP mesmo usando
    // b64_json. Sempre transcodificar evita persistir bytes com MIME incorreto quando não há crop.
    const { data, info } = await output
      .png()
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  } catch {
    throw invalidResponse();
  }
};

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

  const imageModel = config.imageModel;
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

    ...(imageModel
      ? {
          /**
           * Pede `b64_json` em vez de URL: URL de provedor expira em horas. Depois traduz a forma
           * nativa para a proporção exata prometida pelo port.
           */
          async generateImage({ prompt, aspect, quality, signal }) {
            const { size } = RESOLUCAO_POR_PROPORCAO[aspect];
            const raw = await postJson(
              config,
              fetchImpl,
              'images/generations',
              {
                model: imageModel,
                prompt,
                size,
                n: 1,
                response_format: 'b64_json',
                ...(quality ? { quality: quality === 'draft' ? 'low' : 'standard' } : {}),
              },
              authHeaders(config.apiKey, (key) => ({ authorization: `Bearer ${key}` })),
              signal,
            );

            const reply = raw as ImageReply;
            const primeira = reply.data?.[0];
            if (!primeira?.b64_json) throw invalidResponse();

            const cropped = await cropToAspect(decodeBase64(primeira.b64_json), aspect);
            return {
              ...cropped,
              // declarado; quem valida de verdade é o caso de uso, por magic bytes
              mime: 'image/png',
              ...(primeira.revised_prompt ? { revisedPrompt: primeira.revised_prompt } : {}),
            };
          },
        }
      : {}),
  };
}
