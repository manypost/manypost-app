import { aiConfigFromEnv, imageConfigFromEnv, type Env } from '@manypost/config';
import {
  makeAiProvider,
  makeImageGenerationProvider,
  type FetchLike,
} from '@manypost/core';

/**
 * Único ponto onde a API liga configuração resolvida aos adapters reais.
 * Mantê-lo puro torna verificável que texto e imagem não cruzam endpoint ou credencial.
 */
export function makeConfiguredAiProviders(env: Env, fetchImpl: FetchLike = fetch) {
  const imageConfig = imageConfigFromEnv(env);
  return {
    text: makeAiProvider(aiConfigFromEnv(env), fetchImpl),
    image: makeImageGenerationProvider(imageConfig, fetchImpl),
    imageConfig,
  };
}
