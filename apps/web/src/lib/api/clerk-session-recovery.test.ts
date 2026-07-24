import { afterEach, describe, expect, it } from 'bun:test';
import {
  recoverInternalSession,
  setClerkTokenProvider,
} from './clerk-session-recovery';

afterEach(() => setClerkTokenProvider(null));

describe('recuperação da sessão interna pelo Clerk', () => {
  it('deduplica tentativas concorrentes e falha fechado sem token', async () => {
    let requests = 0;
    setClerkTokenProvider(async () => 'clerk-session');
    const request = async (token: string) => {
      requests += 1;
      expect(token).toBe('clerk-session');
      await Promise.resolve();
      return true;
    };

    const results = await Promise.all([
      recoverInternalSession(request),
      recoverInternalSession(request),
    ]);
    expect(results).toEqual([true, true]);
    expect(requests).toBe(1);

    setClerkTokenProvider(async () => null);
    expect(await recoverInternalSession(request)).toBe(false);
  });
});
