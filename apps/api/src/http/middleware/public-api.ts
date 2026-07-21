import type { MiddlewareHandler } from 'hono';
import { ErrorCodes } from '@manypost/contracts';
import {
  DomainError,
  type IdempotencyStore,
  type RateLimiter,
  sha256Hex,
} from '@manypost/core';
import type { AppEnv } from './context';

/**
 * Rate-limit por credencial da API pública (SPEC_API_MCP §3): token bucket Redis por
 * credencial (API key ou usuário), com headers `RateLimit-*` (draft IETF) e 429 + `Retry-After`.
 * Sem Redis o limiter é indefinido → falha aberta (Redis é descartável, SPEC_INFRA §1).
 */
export const rateLimitByCredential = (
  limiter: RateLimiter | undefined,
  opts: { limit: number; windowSec: number },
): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (!limiter) return next();
    const p = c.get('principal');
    const cred = p.kind === 'api_key' ? `k:${p.apiKeyId}` : `u:${p.userId}`;
    const verdict = await limiter.acquire([
      { key: `pub:cred:${cred}`, limit: opts.limit, windowSec: opts.windowSec },
    ]);
    c.header('RateLimit-Limit', String(opts.limit));
    c.header('RateLimit-Policy', `${opts.limit};w=${opts.windowSec}`);
    if (!verdict.ok) {
      c.header('RateLimit-Remaining', '0');
      c.header('RateLimit-Reset', String(verdict.retryAfterSec));
      c.header('Retry-After', String(verdict.retryAfterSec));
      throw new DomainError(ErrorCodes.RateLimited, 'rate limit — aguarde e tente de novo', {
        retryAfterSec: verdict.retryAfterSec,
      });
    }
    await next();
  };

/**
 * Idempotência de POSTs de mutação (SPEC_API_MCP §3, critério de aceite §7.6): com o header
 * `Idempotency-Key`, a repetição do MESMO POST (mesma chave + mesmo corpo) devolve a resposta
 * original em vez de repetir o efeito. Só age em POST com o header presente; sem store (Redis)
 * é falha aberta (o handler roda normalmente). Fingerprint = método+rota+corpo, então reusar a
 * mesma chave em outra rota/corpo é `conflict` (409). Só respostas 2xx são guardadas p/ replay;
 * erro/não-2xx libera a reserva para o cliente poder tentar de novo.
 */
export const idempotency = (
  store: IdempotencyStore | undefined,
  opts: { ttlSec?: number } = {},
): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const idemKey = c.req.header('idempotency-key');
    if (!store || c.req.method !== 'POST' || !idemKey) return next();

    const ttl = opts.ttlSec ?? 86_400; // 24h
    const p = c.get('principal');
    // clona o Request p/ ler o corpo sem consumir o stream que o handler ainda vai parsear
    const bodyText = await c.req.raw.clone().text();
    const fingerprint = sha256Hex(`${c.req.method}:${c.req.path}:${bodyText}`);
    // namespaced por CREDENCIAL (não por org): idempotência é por credencial — evita replay
    // cruzado entre chaves distintas da mesma org e o bypass do escopo da rota no replay
    const cred = p.kind === 'api_key' ? p.apiKeyId : p.userId;
    const key = `idem:${cred}:${sha256Hex(idemKey)}`;

    const claim = await store.claim(key, fingerprint, ttl);
    if (claim.outcome === 'replay') {
      c.header('Idempotency-Replayed', 'true');
      return c.body(claim.response.body, claim.response.status as never, {
        'content-type': 'application/json',
      });
    }
    if (claim.outcome === 'conflict') {
      throw new DomainError(
        ErrorCodes.IdempotencyConflict,
        'Idempotency-Key já usada com um corpo diferente',
      );
    }
    if (claim.outcome === 'pending') {
      throw new DomainError(
        ErrorCodes.IdempotencyConflict,
        'requisição idêntica ainda em processamento — tente de novo em instantes',
      );
    }

    // claim === 'claimed' — nós processamos e guardamos o resultado
    try {
      await next();
    } catch (err) {
      await store.release(key); // handler lançou: libera p/ nova tentativa
      throw err;
    }
    if (c.res.status >= 200 && c.res.status < 300) {
      const body = await c.res.clone().text();
      await store.store(key, { status: c.res.status, body }, ttl);
    } else {
      await store.release(key); // não-2xx não é replayável
    }
  };
