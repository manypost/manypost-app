import { describe, expect, test } from 'bun:test';
import type { ChannelProvider, MediaRef, ProviderContext } from '@manypost/contracts';
import { settingsJsonSchema } from '../src/shared/settings-json-schema';

/** ctx com fetch mockado — providers nunca tocam a rede em teste (SPEC_INTEGRATIONS §7). */
export function mockCtx(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  secrets: Record<string, string> = {},
): ProviderContext & { calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  return {
    calls,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, ...(init ? { init } : {}) });
      return handler(url, init);
    }) as typeof fetch,
    log: () => {},
    now: () => new Date('2026-01-01T12:00:00Z'),
    secrets,
  };
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const image = (n: number): MediaRef[] =>
  Array.from({ length: n }, (_, i) => ({
    type: 'image',
    url: `https://cdn.test/img-${i}.png`,
    mime: 'image/png',
  }));

const video = (): MediaRef[] => [
  { type: 'video', url: 'https://cdn.test/v.mp4', mime: 'video/mp4' },
];

/**
 * Suíte de contrato obrigatória (SPEC_INTEGRATIONS §7): todo provider registra
 * `runProviderContract(provider)` no seu arquivo de teste. Golden tests de payload
 * são por provider, fora daqui.
 */
export function runProviderContract(provider: ChannelProvider) {
  describe(`contrato do provider ${provider.id}`, () => {
    test('identidade e capacidades declarativas', () => {
      expect(provider.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(provider.name.length).toBeGreaterThan(0);
      expect(provider.capabilities.maxLength(undefined)).toBeGreaterThan(0);
      expect(provider.rateDefaults.maxConcurrent).toBeGreaterThan(0);
    });

    test('settingsSchema aceita objeto vazio ou aplica defaults sem lançar', () => {
      // publicação sem settings explícitos é o caminho comum — não pode explodir
      expect(() => provider.settingsSchema.safeParse({})).not.toThrow();
    });

    test('settingsSchema é serializável p/ JSON Schema (catálogo /v1/channels/providers)', () => {
      const json = settingsJsonSchema(provider.settingsSchema);
      expect(json.type).toBe('object');
      // round-trip: o catálogo devolve isso como JSON puro p/ a UI montar o formulário
      expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    });

    test('classifyError: 429/5xx → transient, 401 → refresh-token, 4xx → permanent', () => {
      expect(provider.classifyError(429, '')).toBe('transient');
      expect(provider.classifyError(500, '')).toBe('transient');
      expect(provider.classifyError(503, '')).toBe('transient');
      expect(provider.classifyError(401, '')).toBe('refresh-token');
      expect(provider.classifyError(422, 'corpo inválido')).toBe('permanent');
      expect(provider.classifyError(400, '')).toBe('permanent');
    });

    test('validateMedia respeita contagem máxima e mistura', async () => {
      const { images, videos } = provider.capabilities.media;
      expect(await provider.validateMedia([{ content: 'ok', media: [] }])).toEqual({ ok: true });

      if (images.maxCount > 0) {
        const within = await provider.validateMedia([
          { content: 'ok', media: image(images.maxCount) },
        ]);
        expect(within.ok).toBe(true);
        const above = await provider.validateMedia([
          { content: 'demais', media: image(images.maxCount + 1) },
        ]);
        expect(above.ok).toBe(false);
      }
      if (videos.maxCount === 0) {
        const rejected = await provider.validateMedia([{ content: 'video', media: video() }]);
        expect(rejected.ok).toBe(false);
      }
    });

    test('threads declarado exige publishReply implementado', () => {
      if (provider.capabilities.threads) {
        expect(typeof provider.publishReply).toBe('function');
      }
    });

    test('conexão declarada de um jeito só: connectWithFields OU fluxo OAuth', () => {
      if (provider.connectWithFields) {
        // provider de credenciais precisa dizer quais campos pedir
        expect(provider.connectionFieldsSchema).toBeDefined();
      }
    });

    test('connectionFieldsSchema (quando presente) é serializável p/ JSON Schema (catálogo)', () => {
      if (!provider.connectionFieldsSchema) return;
      const json = settingsJsonSchema(provider.connectionFieldsSchema);
      expect(json.type).toBe('object');
      // todo campo de conexão é visível na UI — precisa de properties nomeadas
      expect(Object.keys((json.properties as object) ?? {}).length).toBeGreaterThan(0);
      expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    });
  });
}
