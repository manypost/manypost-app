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

  it('manda visitante para login e usuário autenticado para o app', () => {
    expect(authRouteAction('/calendario', false)).toBe('login');
    expect(authRouteAction('/login', true)).toBe('app');
    expect(authRouteAction('/registro', false)).toBe('allow');
  });

  it('recupera a sessão interna quando Clerk está autenticado mas os cookies internos faltam', () => {
    expect(authRouteAction('/calendario', true, false)).toBe('complete');
    expect(authRouteAction('/login', true, false)).toBe('complete');
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
