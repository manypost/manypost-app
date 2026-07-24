import { type NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Guarda de presença de sessão (SPEC_FRONTEND §1: o middleware só verifica
 * presença; autorização é 100% do backend). `mp_at` expira em 15min, então a
 * presença de sessão viva é sinalizada pelo marcador `mp_session` (mesma vida
 * do refresh token) — o refresh de verdade acontece no cliente da API (401 →
 * POST /v1/auth/refresh → retry).
 */
const PUBLIC_PATHS = new Set(['/login', '/registro']);
const PUBLIC_PREFIXES = [
  '/approve/',
  '/sso-callback',
  '/auth/complete',
  '/session-tasks/',
  '/__clerk/',
];

export type AuthRouteAction = 'allow' | 'login' | 'complete' | 'app';

export function authRouteAction(
  pathname: string,
  signedIn: boolean,
  hasInternalSession = signedIn,
): AuthRouteAction {
  if (
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
    ) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/trpc/')
  ) {
    return 'allow';
  }
  if (!signedIn) return PUBLIC_PATHS.has(pathname) ? 'allow' : 'login';
  if (!hasInternalSession) return 'complete';
  return PUBLIC_PATHS.has(pathname) ? 'app' : 'allow';
}

function route(req: NextRequest, signedIn: boolean, hasInternalSession: boolean) {
  const { pathname } = req.nextUrl;
  const action = authRouteAction(pathname, signedIn, hasInternalSession);
  if (action === 'app') return NextResponse.redirect(new URL('/calendario', req.url));
  if (action === 'complete') {
    const url = new URL('/auth/complete', req.url);
    if (!PUBLIC_PATHS.has(pathname) && pathname !== '/') url.searchParams.set('de', pathname);
    return NextResponse.redirect(url);
  }
  if (action === 'login') {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('de', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);
const withClerk = clerkMiddleware(async (auth, req) => {
  const session = await auth();
  return route(
    req,
    Boolean(session.userId),
    req.cookies.has('mp_at') || req.cookies.has('mp_session'),
  );
});

export const proxy = clerkEnabled
  ? withClerk
  : (req: NextRequest) => {
      const hasInternalSession = req.cookies.has('mp_at') || req.cookies.has('mp_session');
      return route(req, hasInternalSession, hasInternalSession);
    };

export default proxy;

export const config = {
  // /v1, /uploads e /public são proxy p/ a API; estáticos e _next ficam de fora.
  // `mcp` segue na lista mesmo sem rewrite: o servidor MCP mudou para o host dedicado
  // (MCP_PUBLIC_URL) e um cliente que ainda aponte para cá deve ver 404 — não um 302 para
  // a tela de login, que ele não sabe interpretar.
  matcher: [
    '/((?!v1|uploads|public|mcp|_next|favicon\\.ico|.*\\..*).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
