import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { ACCESS_TTL_SEC, REFRESH_TTL_SEC } from '@manypost/core';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './middleware/auth';

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
}
