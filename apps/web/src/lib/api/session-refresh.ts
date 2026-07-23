const CREDENTIAL_ENDPOINTS = [
  '/v1/auth/login',
  '/v1/auth/register',
  '/v1/auth/refresh',
  '/v1/auth/logout',
  '/v1/auth/social',
] as const;

export function shouldAttemptSessionRefresh(rawUrl: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(rawUrl, 'http://manypost.local').pathname;
  } catch {
    return false;
  }

  return !CREDENTIAL_ENDPOINTS.some(
    (endpoint) => pathname === endpoint || pathname.startsWith(`${endpoint}/`),
  );
}
