/**
 * Seleção do adapter de IA — a fronteira. Daqui para fora do diretório, o resto do monorepo só
 * conhece o port `AiProvider`; nenhum caso de uso, rota ou componente sabe qual protocolo ou
 * qual fornecedor está do outro lado (SPEC_AI §2, CI: `bun run check:ai-providers`).
 *
 * `null` = instalação sem IA (`AI_PROVIDER=none`). O composition root não monta o bundle e as
 * rotas respondem `capability.disabled` — a UI some com os botões (SPEC_AI §5.2).
 */
import type { AiProvider, ImageGenerationProvider } from '../../application/ports/ai-provider';
import { makeChatCompletionsProvider } from './chat-completions';
import { makeImageGenerationsProvider } from './image-generations';
import { makeMessagesProvider } from './messages';
import type { AiAdapterConfig, FetchLike, ImageAdapterConfig } from './shared';

export type AiProviderConfig = AiAdapterConfig & {
  protocol: 'openai-compatible' | 'anthropic';
};

export function makeAiProvider(
  config: AiProviderConfig | null,
  fetchImpl: FetchLike = fetch,
): AiProvider | null {
  if (!config) return null;
  return config.protocol === 'anthropic'
    ? makeMessagesProvider(config, fetchImpl)
    : makeChatCompletionsProvider(config, fetchImpl);
}

export type ImageProviderConfig = ImageAdapterConfig & {
  protocol: 'openai-compatible';
};

export function makeImageGenerationProvider(
  config: ImageProviderConfig | null,
  fetchImpl: FetchLike = fetch,
): ImageGenerationProvider | null {
  if (!config) return null;
  return makeImageGenerationsProvider(config, fetchImpl);
}

export type { AiAdapterConfig, FetchLike, ImageAdapterConfig } from './shared';
