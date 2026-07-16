import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { ACCESS_TTL_SEC, REFRESH_TTL_SEC } from '@manypost/core';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './middleware/auth';

/**
 * Marcador de sessão SEM valor sensível ('1'), com a vida do refresh token.
 * Existe porque `mp_at` expira em 15min e `mp_rt` só viaja em /v1/auth/* —
 * é o que permite ao middleware do apps/web "só verificar presença"
 * (SPEC_FRONTEND §1) sem ver o refresh token.
 */
export const SESSION_HINT_COOKIE = 'mp_session';

export function setAuthCookies(c: Context, secure: boolean, accessToken: string, refreshToken: string) {
  setCookie(c, ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: ACCESS_TTL_SEC,
  });
  setCookie(c, REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/v1/auth',
    maxAge: REFRESH_TTL_SEC,
  });
  setCookie(c, SESSION_HINT_COOKIE, '1', {
    httpOnly: false,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: REFRESH_TTL_SEC,
  });
}
