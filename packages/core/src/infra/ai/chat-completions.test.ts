import { describe, expect, it } from 'bun:test';
import { DomainError } from '../../domain/shared/result';
import { makeChatCompletionsProvider } from './chat-completions';

const config = {
  baseUrl: 'https://gateway.example/v1',
  apiKey: 'nao-e-uma-chave-real',
  model: 'modelo-de-teste',
  timeoutMs: 5000,
  maxOutputTokens: 500,
};

/** dublê de fetch: guarda a última requisição e devolve o que o teste mandar */
function fakeFetch(reply: { status?: number; body?: unknown; text?: string }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(reply.text ?? JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return Object.assign(fn, { calls });
}

const okBody = {
  choices: [{ message: { content: 'legenda gerada' } }],
  usage: { prompt_tokens: 120, completion_tokens: 30 },
};

const body = (fetchImpl: { calls: { init: RequestInit }[] }) =>
  JSON.parse(String(fetchImpl.calls[0]!.init.body));

describe('adapter de chat-completions', () => {
  it('manda system, prompt, modelo e o teto de saída da INSTALAÇÃO', async () => {
    const f = fakeFetch({ body: okBody });
    const provider = makeChatCompletionsProvider(config, f);

    const result = await provider.generateText({
      system: 'instrução',
      prompt: 'brief',
      maxTokens: 200,
    });

    expect(result.text).toBe('legenda gerada');
    expect(f.calls[0]!.url).toBe('https://gateway.example/v1/chat/completions');
    const sent = body(f);
    expect(sent.model).toBe('modelo-de-teste');
    expect(sent.messages).toEqual([
      { role: 'system', content: 'instrução' },
      { role: 'user', content: 'brief' },
    ]);
    // o teto enviado é o do operador, não o pedido: `max_tokens` é TETO, não alvo, e modelo de
    // raciocínio precisa de folga para pensar antes de escrever (o tamanho por canal é
    // garantido depois, deterministicamente)
    expect(sent.max_tokens).toBe(500);
  });

  it('o teto de saída é sempre o da instalação, pedindo pouco ou pedindo muito', async () => {
    for (const pedido of [10, 200, 99_999]) {
      const f = fakeFetch({ body: okBody });
      await makeChatCompletionsProvider(config, f).generateText({
        system: 's',
        prompt: 'p',
        maxTokens: pedido,
      });
      expect(body(f).max_tokens).toBe(500);
    }
  });

  it('lê o consumo de tokens de volta (é o que o BudgetGuard confirma)', async () => {
    const f = fakeFetch({ body: okBody });
    const { usage } = await makeChatCompletionsProvider(config, f).generateText({
      system: 's',
      prompt: 'p',
      maxTokens: 10,
    });
    expect(usage).toEqual({ inputTokens: 120, outputTokens: 30 });
  });

  it('sem chave configurada, não manda header de autorização (runtime local)', async () => {
    const f = fakeFetch({ body: okBody });
    const { apiKey: _semChave, ...semChave } = config;
    await makeChatCompletionsProvider(semChave, f).generateText({
      system: 's',
      prompt: 'p',
      maxTokens: 10,
    });
    const headers = new Headers(f.calls[0]!.init.headers as Record<string, string>);
    expect(headers.has('authorization')).toBe(false);
  });

  it.each([
    [401, 'credencial recusada'],
    [403, 'sem permissão'],
  ])('erro %i vira ai.provider_failed sem vazar corpo, endpoint nem chave', async (status) => {
    const f = fakeFetch({ status, text: 'chave nao-e-uma-chave-real invalida' });
    const provider = makeChatCompletionsProvider(config, f);

    const erro = await provider
      .generateText({ system: 's', prompt: 'p', maxTokens: 10 })
      .catch((e: unknown) => e as DomainError);

    expect(erro).toBeInstanceOf(DomainError);
    const texto = `${(erro as DomainError).message} ${JSON.stringify((erro as DomainError).detail)}`;
    expect((erro as DomainError).code).toBe('ai.provider_failed');
    expect(texto).not.toContain('nao-e-uma-chave-real');
    expect(texto).not.toContain('gateway.example');
    expect((erro as DomainError).detail?.retryable).toBe(false);
  });

  it.each([429, 500, 503])('erro %i é marcado como repetível', async (status) => {
    const f = fakeFetch({ status, text: 'indisponível' });
    const erro = await makeChatCompletionsProvider(config, f)
      .generateText({ system: 's', prompt: 'p', maxTokens: 10 })
      .catch((e: unknown) => e as DomainError);

    expect((erro as DomainError).code).toBe('ai.provider_failed');
    expect((erro as DomainError).detail?.retryable).toBe(true);
  });

  // modelo de RACIOCÍNIO gasta tokens de saída pensando antes de escrever: o teto que basta
  // para um modelo comum o corta no meio da palavra. Devolver isso como legenda pronta seria
  // esconder um problema de configuração — verificado contra um provedor real (deepseek-v4-pro)
  it('resposta cortada pelo teto NÃO é devolvida como pronta', async () => {
    const f = fakeFetch({
      body: {
        choices: [{ message: { content: 'É um prazer imenso anunci' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 189, completion_tokens: 400 },
      },
    });
    const erro = await makeChatCompletionsProvider(config, f)
      .generateText({ system: 's', prompt: 'p', maxTokens: 400 })
      .catch((e: unknown) => e as DomainError);

    expect((erro as DomainError).code).toBe('ai.invalid_response');
    // a mensagem aponta a variável a mexer, em vez de dizer só "falhou"
    expect((erro as DomainError).message).toContain('AI_MAX_OUTPUT_TOKENS');
    expect((erro as DomainError).detail?.cap).toBe(500); // o teto da instalação, não o pedido
  });

  it('finish_reason normal passa (não é o teto que decide, é o motivo da parada)', async () => {
    const f = fakeFetch({
      body: { choices: [{ message: { content: 'pronta' }, finish_reason: 'stop' }] },
    });
    const { text } = await makeChatCompletionsProvider(config, f).generateText({
      system: 's',
      prompt: 'p',
      maxTokens: 400,
    });
    expect(text).toBe('pronta');
  });

  it('sucesso sem geração no corpo vira ai.invalid_response, não provider_failed', async () => {
    const f = fakeFetch({ body: { choices: [] } });
    const erro = await makeChatCompletionsProvider(config, f)
      .generateText({ system: 's', prompt: 'p', maxTokens: 10 })
      .catch((e: unknown) => e as DomainError);

    expect((erro as DomainError).code).toBe('ai.invalid_response');
  });

  it('estourar o tempo aborta a chamada e vira ai.provider_failed repetível', async () => {
    const lenta = async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('abortado'), { name: 'AbortError' })),
        );
      });

    const erro = await makeChatCompletionsProvider({ ...config, timeoutMs: 20 }, lenta)
      .generateText({ system: 's', prompt: 'p', maxTokens: 10 })
      .catch((e: unknown) => e as DomainError);

    expect((erro as DomainError).code).toBe('ai.provider_failed');
    expect((erro as DomainError).detail?.retryable).toBe(true);
    expect((erro as DomainError).detail?.timeout).toBe(true);
  });

  it('descreve imagem mandando a referência e o tipo da mídia', async () => {
    const f = fakeFetch({ body: okBody });
    const provider = makeChatCompletionsProvider(config, f);

    const result = await provider.describeImage!({
      imageUrl: 'https://media.example/foto.jpg',
      mimeType: 'image/jpeg',
      system: 's',
      prompt: 'descreva',
      maxTokens: 100,
    });

    expect(result.text).toBe('legenda gerada');
    const partes = body(f).messages.at(-1).content;
    expect(partes).toContainEqual({ type: 'text', text: 'descreva' });
    expect(partes).toContainEqual({
      type: 'image_url',
      image_url: { url: 'https://media.example/foto.jpg' },
    });
  });

  it('a barra final da base não duplica no caminho', async () => {
    const f = fakeFetch({ body: okBody });
    await makeChatCompletionsProvider({ ...config, baseUrl: 'https://g.example/v1/' }, f)
      .generateText({ system: 's', prompt: 'p', maxTokens: 10 });
    expect(f.calls[0]!.url).toBe('https://g.example/v1/chat/completions');
  });
});
