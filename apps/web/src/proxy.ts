import { type NextRequest, NextResponse } from 'next/server';

/**
 * Guarda de presença de sessão (SPEC_FRONTEND §1: o middleware só verifica
 * presença; autorização é 100% do backend). `mp_at` expira em 15min, então a
 * presença de sessão viva é sinalizada pelo marcador `mp_session` (mesma vida
 * do refresh token) — o refresh de verdade acontece no cliente da API (401 →
 * POST /v1/auth/refresh → retry).
 */
const PUBLIC_PATHS = new Set(['/login', '/registro']);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has('mp_at') || req.cookies.has('mp_session');

  if (PUBLIC_PATHS.has(pathname)) {
    return hasSession
      ? NextResponse.redirect(new URL('/calendario', req.url))
      : NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('de', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // /v1 e /uploads são proxy p/ a API; arquivos estáticos e _next ficam de fora
  matcher: ['/((?!v1|uploads|_next|favicon\\.ico|.*\\..*).*)'],
};
