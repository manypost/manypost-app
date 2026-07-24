type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider | null = null;

export function setClerkTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

function isProtectedHumanRequest(input: RequestInfo | URL): boolean {
  const rawUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(rawUrl, 'http://manypost.local').pathname.startsWith('/v1/');
  } catch {
    return false;
  }
}

export const fetchWithClerk: typeof fetch = async (input, init) => {
  if (!isProtectedHumanRequest(input) || !tokenProvider) {
    return fetch(input, init);
  }

  const token = await tokenProvider();
  if (!token) return fetch(input, init);

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  if (!headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
};
