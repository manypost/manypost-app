import { afterEach, describe, expect, it } from 'bun:test';

type ClerkFetchModule = {
  setClerkTokenProvider?: (provider: (() => Promise<string | null>) | null) => void;
  fetchWithClerk?: typeof fetch;
};

const clerkFetch = (await import('./clerk-fetch').catch(() => ({}))) as ClerkFetchModule;

afterEach(() => clerkFetch.setClerkTokenProvider?.(null));

describe('cliente HTTP autenticado pelo Clerk', () => {
  it('anexa o token Clerk a toda requisição humana protegida', async () => {
    expect(clerkFetch.setClerkTokenProvider).toBeFunction();
    expect(clerkFetch.fetchWithClerk).toBeFunction();
    if (!clerkFetch.setClerkTokenProvider || !clerkFetch.fetchWithClerk) return;

    clerkFetch.setClerkTokenProvider(async () => 'clerk-session');
    let authorization: string | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get('authorization');
      return new Response(null, { status: 204 });
    };

    try {
      const response = await clerkFetch.fetchWithClerk('/v1/posts', { method: 'GET' });
      expect(response.status).toBe(204);
      expect(authorization).toBe('Bearer clerk-session');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('não consulta token para rota pública nem tenta exchange ou refresh após 401', async () => {
    expect(clerkFetch.setClerkTokenProvider).toBeFunction();
    expect(clerkFetch.fetchWithClerk).toBeFunction();
    if (!clerkFetch.setClerkTokenProvider || !clerkFetch.fetchWithClerk) return;

    let tokenReads = 0;
    const urls: string[] = [];
    clerkFetch.setClerkTokenProvider(async () => {
      tokenReads += 1;
      return 'clerk-session';
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      return new Response(null, { status: 401 });
    };

    try {
      await clerkFetch.fetchWithClerk('/public/approval/token');
      await clerkFetch.fetchWithClerk('/v1/posts');
      expect(tokenReads).toBe(1);
      expect(urls).toEqual(['/public/approval/token', '/v1/posts']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
