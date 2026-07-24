import { describe, expect, it } from 'bun:test';
import { authRouteAction, config } from './proxy';

describe('proxy Clerk + manypost', () => {
  it('mantém aprovação, callbacks e frontend proxy públicos', () => {
    for (const path of [
      '/approve/token',
      '/sso-callback',
      '/auth/complete',
      '/session-tasks/setup-mfa',
      '/__clerk/client',
    ]) {
      expect(authRouteAction(path, false)).toBe('allow');
    }
  });

  it('libera endpoints de máquina do AS OAuth sem sessão Clerk', () => {
    for (const path of ['/oauth/authorize', '/oauth/register', '/oauth/token']) {
      expect(authRouteAction(path, false)).toBe('allow');
      expect(authRouteAction(path, true)).toBe('allow');
    }
  });

  it('exige login na página de consent OAuth', () => {
    expect(authRouteAction('/oauth/consent', false)).toBe('login');
    expect(authRouteAction('/oauth/consent', true)).toBe('allow');
  });

  it('manda visitante para login e usuário autenticado para o app', () => {
    expect(authRouteAction('/calendario', false)).toBe('login');
    expect(authRouteAction('/login', true)).toBe('app');
    expect(authRouteAction('/registro', false)).toBe('allow');
  });

  it('não depende de cookies internos quando a sessão Clerk está autenticada', () => {
    expect(authRouteAction('/calendario', true)).toBe('allow');
    expect(authRouteAction('/login', true)).toBe('app');
  });

  it('mantém o matcher Clerk uma vez e depois do matcher API/TRPC', () => {
    const apiIndex = config.matcher.indexOf('/(api|trpc)(.*)');
    const clerkIndexes = config.matcher
      .map((value, index) => (value === '/__clerk/:path*' ? index : -1))
      .filter((index) => index >= 0);
    expect(apiIndex).toBeGreaterThanOrEqual(0);
    expect(clerkIndexes).toEqual([apiIndex + 1]);
  });
});
