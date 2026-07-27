import { describe, expect, it } from 'bun:test';
import type { DomainError } from '../../domain/shared/result';
import { makeMessagesProvider } from './messages';

const config = {
  baseUrl: 'https://gateway.example',
  apiKey: 'nao-e-uma-chave-real',
  model: 'modelo-de-teste',
  timeoutMs: 5000,
  maxOutputTokens: 500,
};

function fakeFetch(reply: { status?: number; body?: unknown; bytes?: Uint8Array }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (reply.bytes && !String(url).includes('gateway.example')) {
      return new Response(new Blob([reply.bytes]), { status: 200 });
    }
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200 });
  };
  return Object.assign(fn, { calls });
}

const okBody = {
  content: [{ type: 'text', text: 'legenda gerada' }],
  usage: { input_tokens: 90, output_tokens: 12 },
};

describe('adapter do protocolo de messages', () => {
  it('manda o system em campo próprio e a versão do dialeto no header', async () => {
    const f = fakeFetch({ body: okBody });
    const result = await makeMessagesProvider(config, f).generateText({
      system: 'instrução',
      prompt: 'brief',
      maxTokens: 200,
    });

    expect(result).toEqual({ text: 'legenda gerada', usage: { inputTokens: 90, outputTokens: 12 } });
    expect(f.calls[0]!.url).toBe('https://gateway.example/v1/messages');
    const sent = JSON.parse(String(f.calls[0]!.init.body));
    expect(sent.system).toBe('instrução');
    expect(sent.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'brief' }] }]);
    const headers = new Headers(f.calls[0]!.init.headers as Record<string, string>);
    expect(headers.get('anthropic-version')).toBeTruthy();
    expect(headers.get('x-api-key')).toBe('nao-e-uma-chave-real');
  });

  it('o teto de saída é sempre o da instalação, pedindo pouco ou pedindo muito', async () => {
    for (const pedido of [10, 99_999]) {
      const f = fakeFetch({ body: okBody });
      await makeMessagesProvider(config, f).generateText({
        system: 's',
        prompt: 'p',
        maxTokens: pedido,
      });
      expect(JSON.parse(String(f.calls[0]!.init.body)).max_tokens).toBe(500);
    }
  });

  it('sem chave configurada não manda header de credencial', async () => {
    const f = fakeFetch({ body: okBody });
    const { apiKey: _semChave, ...semChave } = config;
    await makeMessagesProvider(semChave, f).generateText({ system: 's', prompt: 'p', maxTokens: 10 });
    expect(new Headers(f.calls[0]!.init.headers as Record<string, string>).has('x-api-key')).toBe(false);
  });

  it('erro do upstream vira ai.provider_failed sem vazar chave nem endpoint', async () => {
    const f = fakeFetch({ status: 401, body: { erro: 'chave nao-e-uma-chave-real invalida' } });
    const erro = (await makeMessagesProvider(config, f)
      .generateText({ system: 's', prompt: 'p', maxTokens: 10 })
      .catch((e: unknown) => e)) as DomainError;

    expect(erro.code).toBe('ai.provider_failed');
    const texto = `${erro.message} ${JSON.stringify(erro.detail)}`;
    expect(texto).not.toContain('nao-e-uma-chave-real');
    expect(texto).not.toContain('gateway.example');
  });

  it('resposta cortada pelo teto NÃO é devolvida como pronta', async () => {
    const f = fakeFetch({
      body: { content: [{ type: 'text', text: 'cortado no meio' }], stop_reason: 'max_tokens' },
    });
    const erro = (await makeMessagesProvider(config, f)
      .generateText({ system: 's', prompt: 'p', maxTokens: 300 })
      .catch((e: unknown) => e)) as DomainError;

    expect(erro.code).toBe('ai.invalid_response');
    expect(erro.message).toContain('AI_MAX_OUTPUT_TOKENS');
  });

  it('resposta sem bloco de texto vira ai.invalid_response', async () => {
    const f = fakeFetch({ body: { content: [] } });
    const erro = (await makeMessagesProvider(config, f)
      .generateText({ system: 's', prompt: 'p', maxTokens: 10 })
      .catch((e: unknown) => e)) as DomainError;
    expect(erro.code).toBe('ai.invalid_response');
  });

  it('descrever imagem embute os bytes em base64 (este dialeto não aceita URL)', async () => {
    const f = fakeFetch({ body: okBody, bytes: new Uint8Array([1, 2, 3]) });
    const result = await makeMessagesProvider(config, f).describeImage!({
      imageUrl: 'https://media.example/foto.jpg',
      mimeType: 'image/jpeg',
      system: 's',
      prompt: 'descreva',
      maxTokens: 100,
    });

    expect(result.text).toBe('legenda gerada');
    expect(f.calls[0]!.url).toBe('https://media.example/foto.jpg'); // baixou a mídia primeiro
    const blocos = JSON.parse(String(f.calls[1]!.init.body)).messages[0].content;
    expect(blocos[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from([1, 2, 3]).toString('base64') },
    });
    expect(blocos[1]).toEqual({ type: 'text', text: 'descreva' });
  });

  it('mídia ilegível vira ai.provider_failed repetível, não 500', async () => {
    const semMidia = async (url: string | URL | Request) =>
      String(url).includes('gateway.example')
        ? new Response(JSON.stringify(okBody), { status: 200 })
        : new Response('nao encontrado', { status: 404 });

    const erro = (await makeMessagesProvider(config, semMidia)
      .describeImage!({
        imageUrl: 'https://media.example/some.jpg',
        mimeType: 'image/jpeg',
        system: 's',
        prompt: 'p',
        maxTokens: 10,
      })
      .catch((e: unknown) => e)) as DomainError;

    expect(erro.code).toBe('ai.provider_failed');
    expect(erro.detail?.retryable).toBe(true);
  });
});
