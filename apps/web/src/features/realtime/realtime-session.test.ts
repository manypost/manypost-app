import { describe, expect, it } from 'bun:test';

type SessionAction = 'open' | 'expire' | 'retry';
type RealtimeSessionModule = {
  realtimeSessionAction?: (response: Response | null | undefined) => SessionAction;
  clearSessionHint?: (target: { cookie: string }) => void;
  expireBrowserSession?: (input: {
    logout: () => Promise<unknown>;
    target: { cookie: string };
    navigate: (path: string) => void;
  }) => Promise<void>;
};

const sessionModule = (await import('./realtime-session').catch(() => ({}))) as RealtimeSessionModule;

describe('decisão de sessão antes do SSE', () => {
  it('abre o stream somente após resposta autenticada', () => {
    expect(sessionModule.realtimeSessionAction?.(new Response(null, { status: 200 }))).toBe('open');
  });

  it('expira a sessão quando /auth/me continua 401 após o refresh', () => {
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

  it('remove o marcador não sensível usado pelo proxy web', () => {
    const target = { cookie: '' };

    sessionModule.clearSessionHint?.(target);

    expect(target.cookie).toBe('mp_session=; Path=/; Max-Age=0; SameSite=Lax');
  });

  it('encerra cookies HttpOnly no backend antes de navegar para login', async () => {
    const target = { cookie: '' };
    const steps: string[] = [];

    await sessionModule.expireBrowserSession?.({
      logout: async () => {
        steps.push('logout');
      },
      target,
      navigate: (path) => steps.push(`navigate:${path}`),
    });

    expect(target.cookie).toBe('mp_session=; Path=/; Max-Age=0; SameSite=Lax');
    expect(steps).toEqual(['logout', 'navigate:/login']);
  });

  it('ainda remove o marcador e navega quando o logout de rede falha', async () => {
    const target = { cookie: '' };
    let destination = '';

    await sessionModule.expireBrowserSession?.({
      logout: async () => {
        throw new Error('network');
      },
      target,
      navigate: (path) => {
        destination = path;
      },
    });

    expect(target.cookie).toContain('Max-Age=0');
    expect(destination).toBe('/login');
  });
});
