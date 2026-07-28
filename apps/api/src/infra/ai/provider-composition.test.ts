import { describe, expect, it } from 'bun:test';
import { loadEnv } from '@manypost/config';
import { makeConfiguredAiProviders } from './provider-composition';

const base = {
  MODE: 'api',
  PUBLIC_URL: 'https://manypost.test',
  DATABASE_URL: 'postgresql://mp:mp@localhost:5432/mp',
  REDIS_URL: 'redis://localhost:6379',
  ENCRYPTION_KEY: 'a'.repeat(64),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  CLERK_SECRET_KEY: 'sk_test_example',
};

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAL8AAAC/AQMAAACVJJ9FAAAAA1BMVEUqW3iVMYN9AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAG0lEQVRYw+3BMQEAAADCoPVPbQwfoAAAAADgbhKnAAHV6RVBAAAAAElFTkSuQmCC';

function fakeFetch() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    if (call.url.includes('/images/generations')) {
      return Response.json({ data: [{ b64_json: PNG_B64 }] });
    }
    return Response.json({
      choices: [{ message: { content: 'texto gerado' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
  };
  return Object.assign(fn, { calls });
}

describe('composição dos providers de IA da API', () => {
  it('monta texto e imagem reais com conexões e credenciais diferentes', async () => {
    const fetchImpl = fakeFetch();
    const providers = makeConfiguredAiProviders(
      loadEnv({
        ...base,
        AI_PROVIDER: 'openai-compatible',
        AI_BASE_URL: 'https://text.example/v1',
        AI_API_KEY: 'text-key',
        AI_MODEL: 'text-model',
        AI_IMAGE_PROVIDER: 'openai-compatible',
        AI_IMAGE_BASE_URL: 'https://image.example/v1',
        AI_IMAGE_API_KEY: 'image-key',
        AI_IMAGE_MODEL: 'image-model',
      }),
      fetchImpl,
    );

    await providers.text!.generateText({ system: 's', prompt: 'p', maxTokens: 10 });
    await providers.image!.generateImage({
      prompt: 'um gato',
      aspect: '1:1',
      mode: 'economy',
    });

    expect(fetchImpl.calls.map((call) => call.url)).toEqual([
      'https://text.example/v1/chat/completions',
      'https://image.example/v1/images/generations',
    ]);
    expect(
      fetchImpl.calls.map((call) => new Headers(call.init.headers).get('authorization')),
    ).toEqual(['Bearer text-key', 'Bearer image-key']);
    expect(providers.imageConfig?.model).toBe('image-model');
  });

  it('mantém imagem explícita ativa quando o provider de texto está desligado', () => {
    const providers = makeConfiguredAiProviders(
      loadEnv({
        ...base,
        AI_PROVIDER: 'none',
        AI_IMAGE_PROVIDER: 'openai-compatible',
        AI_IMAGE_BASE_URL: 'https://image.example/v1',
        AI_IMAGE_MODEL: 'image-model',
      }),
      fakeFetch(),
    );

    expect(providers.text).toBeNull();
    expect(providers.image).not.toBeNull();
  });
});
