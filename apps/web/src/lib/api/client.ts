import createClient from 'openapi-fetch';
import type { paths } from './schema';

/**
 * Único ponto de saída HTTP do app (SPEC_FRONTEND §5.1: nenhum fetch manual
 * fora do cliente gerado). Tudo é same-origin: o Next proxeia /v1 → API, e a
 * autenticação vai em cookies httpOnly.
 *
 * Sessão: `mp_at` dura 15min. Num 401 (fora de /v1/auth/*) tentamos UMA vez
 * POST /v1/auth/refresh (deduplicado entre chamadas concorrentes — rotação de
 * refresh token detecta reuso e revoga a família, então NUNCA dispare dois
 * refresh em paralelo) e repetimos a requisição original.
 */
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    });
  return refreshing;
}

const fetchWithRefresh: typeof fetch = async (input, init) => {
  const retryable = input instanceof Request ? input.clone() : null;
  const res = await fetch(input, init);
  if (res.status !== 401) return res;

  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/v1/auth/')) return res; // login/refresh falhando é falha de verdade

  if (!(await refreshSession())) return res;
  return fetch(retryable ?? input, init);
};

export const api = createClient<paths>({
  baseUrl: '/',
  credentials: 'include',
  fetch: fetchWithRefresh,
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
