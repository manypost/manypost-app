import { describe, expect, it } from 'bun:test';

type SessionAction = 'open' | 'expire' | 'retry';
type RealtimeSessionModule = {
  realtimeSessionAction?: (response: Response | null | undefined) => SessionAction;
  expireBrowserSession?: (input: {
    logout: () => Promise<unknown>;
    navigate: (path: string) => void;
  }) => Promise<void>;
};

const sessionModule = (await import('./realtime-session').catch(() => ({}))) as RealtimeSessionModule;

describe('decisão de sessão antes do SSE', () => {
  it('abre o stream somente após resposta autenticada', () => {
    expect(sessionModule.realtimeSessionAction?.(new Response(null, { status: 200 }))).toBe('open');
  });

  it('expira a sessão Clerk quando /auth/me responde 401', () => {
    expect(sessionModule.realtimeSessionAction?.(new Response(null, { status: 401 }))).toBe(
      'expire',
    );
  });

  it('tenta o check novamente em falha transitória sem abrir o stream', () => {
    expect(sessionModule.realtimeSessionAction?.(new Response(null, { status: 503 }))).toBe(
      'retry',
    );
    expect(sessionModule.realtimeSessionAction?.(undefined)).toBe('retry');
  });

  it('encerra a sessão Clerk antes de navegar para login', async () => {
    const steps: string[] = [];

    await sessionModule.expireBrowserSession?.({
      logout: async () => {
        steps.push('logout');
      },
      navigate: (path) => steps.push(`navigate:${path}`),
    });

    expect(steps).toEqual(['logout', 'navigate:/login']);
  });

  it('ainda navega quando o logout Clerk falha', async () => {
    let destination = '';

    await sessionModule.expireBrowserSession?.({
      logout: async () => {
        throw new Error('network');
      },
      navigate: (path) => {
        destination = path;
      },
    });

    expect(destination).toBe('/login');
  });
});
