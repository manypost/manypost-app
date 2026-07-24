import { type NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

/** Guarda de sessão Clerk; autorização continua 100% no backend manypost. */
const PUBLIC_PATHS = new Set(['/login', '/registro']);
const PUBLIC_PREFIXES = [
  '/approve/',
  '/sso-callback',
  '/auth/complete',
  '/session-tasks/',
  '/__clerk/',
];

export type AuthRouteAction = 'allow' | 'login' | 'app';

export function authRouteAction(
  pathname: string,
  signedIn: boolean,
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
  return PUBLIC_PATHS.has(pathname) ? 'app' : 'allow';
}

function route(req: NextRequest, signedIn: boolean) {
  const { pathname } = req.nextUrl;
  const action = authRouteAction(pathname, signedIn);
  if (action === 'app') return NextResponse.redirect(new URL('/calendario', req.url));
  if (action === 'login') {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('de', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

const withClerk = clerkMiddleware(async (auth, req) => {
  const session = await auth();
  return route(req, Boolean(session.userId));
});

export const proxy = withClerk;

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
