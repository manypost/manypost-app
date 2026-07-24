import { describe, expect, it } from 'bun:test';

type RefreshPolicyModule = {
  shouldAttemptSessionRefresh?: (url: string) => boolean;
};

const policyModule = (await import('./session-refresh').catch(() => ({}))) as RefreshPolicyModule;

describe('política de refresh em resposta 401', () => {
  it('tenta renovar a sessão para /auth/me e rotas protegidas', () => {
    expect(policyModule.shouldAttemptSessionRefresh?.('/v1/auth/me')).toBe(true);
    expect(policyModule.shouldAttemptSessionRefresh?.('/v1/posts')).toBe(true);
  });

  it('não recursa em endpoints que criam, renovam ou encerram credenciais', () => {
    for (const path of [
      '/v1/auth/login',
      '/v1/auth/register',
      '/v1/auth/refresh',
      '/v1/auth/logout',
      '/v1/auth/social/google',
      '/v1/auth/clerk/exchange',
    ]) {
      expect(policyModule.shouldAttemptSessionRefresh?.(path)).toBe(false);
    }
  });
});
