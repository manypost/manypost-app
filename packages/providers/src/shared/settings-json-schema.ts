import type { ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Converte o settingsSchema (Zod) de um provider em JSON Schema puro para o
 * catálogo `GET /v1/channels/providers` — é o que permite à UI renderizar o
 * formulário "Configurações" por canal sem conhecer cada provider
 * (SPEC_INTEGRATIONS §2; test-kit exige serializável).
 */
export function settingsJsonSchema(schema: ZodType): Record<string, unknown> {
  // $refStrategy none = schema inline, sem definitions — a UI lê `properties` direto
  const { $schema: _, ...json } = zodToJsonSchema(schema, { $refStrategy: 'none' });
  return json as Record<string, unknown>;
}
