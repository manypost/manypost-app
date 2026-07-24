import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { RouteConfig } from '@hono/zod-openapi';
import type { AppEnv } from './middleware/context';

/**
 * Infra de documentação OpenAPI (SPEC_API_MCP §3). A superfície é documentada com
 * `app.openAPIRegistry.registerPath(...)` reaproveitando os schemas de request já
 * definidos nas rotas + schemas de response nomeados — sem alterar nenhum handler.
 * O explorador `/docs` (Scalar) e o cliente OpenAPI do futuro apps/web consomem isto.
 */

/**
 * problem+json (RFC 9457) — a MESMA forma emitida por http/middleware/error.ts.
 * `title` carrega o código estável do erro (DomainError.code) ou 'validation.invalid_request'.
 */
export const ErrorResponse = z
  .object({
    type: z.string().openapi({ example: 'about:blank' }),
    title: z.string().openapi({ example: 'common.not_found', description: 'código estável do erro' }),
    status: z.number().int().openapi({ example: 404 }),
    detail: z.string().optional().openapi({ example: 'post não encontrado' }),
    extra: z.unknown().optional().openapi({ description: 'campos extras (ex.: issues de validação)' }),
  })
  .openapi('Error');

/**
 * Fábrica de sub-app: OpenAPIHono tipado no AppEnv com defaultHook que transforma
 * falha de validação (query/param/body das rotas escritas com createRoute) em ZodError,
 * que o errorHandler converte em 400 problem+json — mantém o contrato de erro uniforme.
 */
export const createApp = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) throw result.error;
    },
  });

const ERROR_DESC: Record<number, string> = {
  400: 'requisição fora do contrato (problem+json)',
  401: 'não autenticado',
  402: 'plano atual não inclui — `extra.requiredTier` diz o plano mínimo',
  403: 'papel insuficiente (requer ADMIN/OWNER)',
  404: 'não encontrado',
  409: 'conflito',
  429: 'rate limit — aguarde e tente de novo',
  503: 'provedor externo temporariamente indisponível',
};

/** Respostas de erro comuns, todas referenciando o schema Error (application/problem+json). */
export const errorResponses = (...codes: number[]): RouteConfig['responses'] =>
  Object.fromEntries(
    codes.map((code) => [
      code,
      {
        description: ERROR_DESC[code] ?? 'erro',
        content: { 'application/problem+json': { schema: ErrorResponse } },
      },
    ]),
  );

/** Corpo de requisição JSON. `required=false` = corpo opcional (validado só se vier content-type JSON). */
export const jsonBody = (
  schema: z.ZodTypeAny,
  required = true,
): NonNullable<RouteConfig['request']> => ({
  body: { required, content: { 'application/json': { schema } } },
});

/** Resposta 2xx JSON. */
export const jsonResponse = (description: string, schema: z.ZodTypeAny) => ({
  description,
  content: { 'application/json': { schema } },
});

/**
 * Autenticação aceita em rotas protegidas: `Authorization: Bearer <jwt|mp_live_...>`
 * OU cookie de sessão httpOnly `mp_at`. Os schemes são registrados em main.ts.
 */
export const AUTH_SECURITY: NonNullable<RouteConfig['security']> = [
  { bearerAuth: [] },
  { cookieAuth: [] },
];
