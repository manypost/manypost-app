/**
 * Adapter do protocolo OpenAI-compatible `images/generations`.
 *
 * Ele é deliberadamente separado do adapter de chat: endpoint, chave e modelo podem pertencer a
 * outro serviço. Adicionar um protocolo nativo novo exige outro adapter e um registro na fábrica.
 */
import type {
  ImageAspect,
  ImageGenerationProvider,
} from '../../application/ports/ai-provider';
import sharp from 'sharp';
import {
  authHeaders,
  decodeBase64,
  invalidResponse,
  postJson,
  type FetchLike,
  type ImageAdapterConfig,
} from './shared';

type ImageReply = { data?: { b64_json?: string; revised_prompt?: string }[] };

const RESOLUTION_BY_ASPECT: Record<ImageAspect, string> = {
  '1:1': '1024x1024',
  '4:5': '1024x1792',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
  '1.91:1': '1792x1024',
};

const ASPECT_UNITS: Record<ImageAspect, readonly [width: number, height: number]> = {
  '1:1': [1, 1],
  '4:5': [4, 5],
  '9:16': [9, 16],
  '16:9': [16, 9],
  '1.91:1': [191, 100],
};

const cropToAspect = async (
  bytes: Uint8Array,
  aspect: ImageAspect,
): Promise<{ bytes: Uint8Array; width: number; height: number }> => {
  try {
    const input = sharp(bytes, { limitInputPixels: 8192 * 8192 });
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height) throw new Error('dimensões ausentes');

    const [unitWidth, unitHeight] = ASPECT_UNITS[aspect];
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

    const { data, info } = await output.png().toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  } catch {
    throw invalidResponse();
  }
};

export function makeImageGenerationsProvider(
  config: ImageAdapterConfig,
  fetchImpl: FetchLike = fetch,
): ImageGenerationProvider {
  return {
    async generateImage({ prompt, aspect, mode, signal }) {
      const raw = await postJson(
        config,
        fetchImpl,
        'images/generations',
        {
          model: config.model,
          prompt,
          size: RESOLUTION_BY_ASPECT[aspect],
          n: 1,
          quality: mode === 'economy' ? 'low' : 'high',
        },
        authHeaders(config.apiKey, (key) => ({ authorization: `Bearer ${key}` })),
        signal,
      );

      const first = (raw as ImageReply).data?.[0];
      if (!first?.b64_json) throw invalidResponse();

      const cropped = await cropToAspect(decodeBase64(first.b64_json), aspect);
      return {
        ...cropped,
        mime: 'image/png',
        ...(first.revised_prompt ? { revisedPrompt: first.revised_prompt } : {}),
      };
    },
  };
}
