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

/** PNG mínimo válido (assinatura + IHDR) — o bastante para os magic bytes reconhecerem */
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

describe('geração de imagem', () => {
  const imagemOk = { data: [{ b64_json: PNG_B64, revised_prompt: 'um gato, iluminado' }] };

  it('traduz PROPORÇÃO em resolução do fornecedor — o core nunca manda pixel', async () => {
    const f = fakeFetch({ body: imagemOk });
    const provider = makeChatCompletionsProvider({ ...config, imageModel: 'modelo-de-imagem' }, f);

    await provider.generateImage!({ prompt: 'um gato', aspect: '9:16' });

    expect(f.calls[0]!.url).toBe('https://gateway.example/v1/images/generations');
    const enviado = body(f);
    expect(enviado.size).toBe('1024x1792'); // 9:16 → retrato
    expect(enviado.model).toBe('modelo-de-imagem');
    expect(enviado.n).toBe(1); // uma requisição, uma imagem (custo previsível)
  });

  it('cada proporção suportada tem uma resolução própria', async () => {
    const vistos = new Set<string>();
    for (const aspect of ['1:1', '4:5', '9:16', '16:9', '1.91:1'] as const) {
      const f = fakeFetch({ body: imagemOk });
      const provider = makeChatCompletionsProvider(config, f);
      await provider.generateImage!({ prompt: 'x', aspect });
      vistos.add(String(body(f).size));
    }
    // 1:1 e 4:5 podem coincidir num fornecedor sem retrato próprio, mas retrato e paisagem não
    expect(vistos.size).toBeGreaterThanOrEqual(3);
  });

  it('devolve BYTES, dimensões e o prompt revisado — nunca uma URL que expira', async () => {
    const f = fakeFetch({ body: imagemOk });
    const provider = makeChatCompletionsProvider(config, f);

    const img = await provider.generateImage!({ prompt: 'um gato', aspect: '1:1' });

    expect(img.bytes).toBeInstanceOf(Uint8Array);
    expect(img.bytes.byteLength).toBeGreaterThan(8);
    // assinatura PNG: os bytes chegaram decodificados, não em base64
    expect([...img.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(img.width).toBe(1024);
    expect(img.height).toBe(1024);
    expect(img.revisedPrompt).toBe('um gato, iluminado');
    expect(img).not.toHaveProperty('url');
  });

  it('sem o modelo de imagem configurado, usa o modelo geral', async () => {
    const f = fakeFetch({ body: imagemOk });
    const provider = makeChatCompletionsProvider(config, f);
    await provider.generateImage!({ prompt: 'x', aspect: '1:1' });
    expect(body(f).model).toBe('modelo-de-teste');
  });

  it('resposta sem imagem vira ai.invalid_response, não um objeto vazio', async () => {
    const f = fakeFetch({ body: { data: [] } });
    const provider = makeChatCompletionsProvider(config, f);

    const erro = (await provider
      .generateImage!({ prompt: 'x', aspect: '1:1' })
      .catch((e: unknown) => e)) as DomainError;
    expect(erro.code).toBe('ai.invalid_response');
  });

  it('base64 inválido também vira ai.invalid_response', async () => {
    const f = fakeFetch({ body: { data: [{ b64_json: '!!!nao-e-base64!!!' }] } });
    const provider = makeChatCompletionsProvider(config, f);

    const erro = (await provider
      .generateImage!({ prompt: 'x', aspect: '1:1' })
      .catch((e: unknown) => e)) as DomainError;
    expect(erro.code).toBe('ai.invalid_response');
  });

  it('falha do provedor não vaza chave nem endereço', async () => {
    const f = fakeFetch({ status: 500, body: { error: 'nao-e-uma-chave-real vazou' } });
    const provider = makeChatCompletionsProvider(config, f);

    const erro = (await provider
      .generateImage!({ prompt: 'x', aspect: '1:1' })
      .catch((e: unknown) => e)) as DomainError;

    const serializado = JSON.stringify({ m: erro.message, d: erro.detail });
    expect(serializado).not.toContain('nao-e-uma-chave-real');
    expect(serializado).not.toContain('gateway.example');
  });
});
