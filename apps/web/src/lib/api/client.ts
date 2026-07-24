import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { recoverInternalSession } from './clerk-session-recovery';
import { shouldAttemptSessionRefresh } from './session-refresh';

/**
 * Único ponto de saída HTTP do app (SPEC_FRONTEND §5.1: nenhum fetch manual
 * fora do cliente gerado). Tudo é same-origin: o Next proxeia /v1 → API, e a
 * autenticação vai em cookies httpOnly.
 *
 * Sessão: `mp_at` dura 15min. Num 401 de recurso protegido (inclusive
 * `/v1/auth/me`) tentamos UMA vez POST /v1/auth/refresh. Endpoints que criam,
 * renovam ou encerram credenciais ficam de fora para não recursar. O refresh é
 * deduplicado entre chamadas concorrentes — a rotação detecta reuso e revoga a
 * família, então NUNCA dispare dois em paralelo.
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
  if (!shouldAttemptSessionRefresh(url)) return res;

  const refreshed = await refreshSession();
  if (!refreshed && !(await recoverInternalSession())) return res;
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
