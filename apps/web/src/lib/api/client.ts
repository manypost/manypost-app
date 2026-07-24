import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { fetchWithClerk } from './clerk-fetch';

/**
 * Único ponto de saída HTTP do app (SPEC_FRONTEND §5.1: nenhum fetch manual
 * fora do cliente gerado). O Next proxeia /v1 → API e `fetchWithClerk` anexa a
 * sessão Clerk atual a cada requisição humana protegida. Um 401 é definitivo:
 * não existe exchange, refresh ou fallback para sessão manypost.
 */
export const api = createClient<paths>({
  baseUrl: '/',
  credentials: 'include',
  fetch: fetchWithClerk,
});

/** Forma do problem+json da API (RFC 9457) — `title` é o código estável. */
export type ApiProblem = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  extra?: unknown;
};

/** Extrai o código estável do erro (ex.: 'auth.invalid_credentials'). */
export function errorCode(problem: unknown): string {
  const p = problem as ApiProblem | undefined;
  return p?.title ?? 'common.unknown';
}
