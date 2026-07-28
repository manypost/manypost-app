import { describe, expect, it } from 'bun:test';
import sharp from 'sharp';
import { makeImageGenerationProvider } from './index';

const PNG_B64 = (
  await sharp({
    create: {
      width: 191,
      height: 191,
      channels: 4,
      background: { r: 42, g: 91, b: 120, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
).toString('base64');

function fakeFetch() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Response.json({ data: [{ b64_json: PNG_B64 }] });
  };
  return Object.assign(fn, { calls });
}

describe('fábrica plug-and-play de imagem', () => {
  it('monta o adapter registrado sem precisar de uma configuração de texto', async () => {
    const fetchImpl = fakeFetch();
    const provider = makeImageGenerationProvider(
      {
        protocol: 'openai-compatible',
        baseUrl: 'https://images.example/v1',
        apiKey: 'chave-somente-de-imagem',
        model: 'modelo-de-imagem',
        timeoutMs: 5000,
      },
      fetchImpl,
    );

    await provider!.generateImage({
      prompt: 'um gato',
      aspect: '1:1',
      mode: 'economy',
    });

    expect(fetchImpl.calls[0]!.url).toBe('https://images.example/v1/images/generations');
    const headers = new Headers(fetchImpl.calls[0]!.init.headers);
    expect(headers.get('authorization')).toBe('Bearer chave-somente-de-imagem');
    expect(JSON.parse(String(fetchImpl.calls[0]!.init.body)).model).toBe('modelo-de-imagem');
  });

  it('null mantém a capacidade de imagem desativada', () => {
    expect(makeImageGenerationProvider(null, fakeFetch())).toBeNull();
  });
});
