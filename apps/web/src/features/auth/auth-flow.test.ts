import { describe, expect, it } from 'bun:test';

type AuthFlowModule = {
  signInAction?: (status: string) => string;
  signUpAction?: (input: {
    status: string;
    missingFields: string[];
    unverifiedFields: string[];
  }) => string;
  exchangeClerkSession?: (input: {
    getToken: () => Promise<string | null>;
    request: (token: string) => Promise<{ isNewUser: boolean }>;
  }) => Promise<{ isNewUser: boolean }>;
  clerkSsoRequest?: (mode: 'sign-in' | 'sign-up') => {
    mode: 'sign-in' | 'sign-up';
    strategy: string;
    redirectUrl: string;
    redirectCallbackUrl: string;
  };
  logoutBothSessions?: (input: {
    logoutInternal: () => Promise<void>;
    logoutClerk: () => Promise<void>;
  }) => Promise<void>;
  sessionTaskPath?: (key: string | undefined) => string | null;
  exchangeFailureAction?: (error: unknown) => 'retry' | 'sign-out';
};

const flow = (await import('./auth-flow').catch(() => ({}))) as AuthFlowModule;

describe('estado dos fluxos customizados Clerk', () => {
  it('só trata sign-in completo como sessão pronta', () => {
    expect(flow.signInAction?.('complete')).toBe('complete');
    expect(flow.signInAction?.('needs_second_factor')).toBe('additional-verification');
    expect(flow.signInAction?.('needs_client_trust')).toBe('additional-verification');
    expect(flow.signInAction?.('needs_first_factor')).toBe('incomplete');
  });

  it('solicita código somente quando o e-mail é o único requisito pendente', () => {
    expect(
      flow.signUpAction?.({
        status: 'missing_requirements',
        missingFields: [],
        unverifiedFields: ['email_address'],
      }),
    ).toBe('verify-email');
    expect(
      flow.signUpAction?.({
        status: 'missing_requirements',
        missingFields: ['last_name'],
        unverifiedFields: ['email_address'],
      }),
    ).toBe('incomplete');
    expect(
      flow.signUpAction?.({
        status: 'complete',
        missingFields: [],
        unverifiedFields: [],
      }),
    ).toBe('complete');
  });
});

describe('troca de sessão Clerk', () => {
  it('deduplica trocas concorrentes e exige token', async () => {
    let requests = 0;
    const input = {
      getToken: async () => 'session-token',
      request: async (token: string) => {
        requests += 1;
        expect(token).toBe('session-token');
        await Promise.resolve();
        return { isNewUser: true };
      },
    };
    const [first, second] = await Promise.all([
      flow.exchangeClerkSession!(input),
      flow.exchangeClerkSession!(input),
    ]);
    expect(first).toEqual({ isNewUser: true });
    expect(second).toEqual({ isNewUser: true });
    expect(requests).toBe(1);

    await expect(
      flow.exchangeClerkSession!({
        getToken: async () => null,
        request: async () => ({ isNewUser: false }),
      }),
    ).rejects.toThrow('sessão Clerk ausente');
  });
});

describe('Google OAuth e logout', () => {
  it('inicia o Google pelo Clerk e retorna pelos callbacks internos', () => {
    expect(flow.clerkSsoRequest?.('sign-up')).toEqual({
      mode: 'sign-up',
      strategy: 'oauth_google',
      redirectUrl: '/auth/complete',
      redirectCallbackUrl: '/sso-callback',
    });
  });

  it('encerra Clerk mesmo quando o logout interno falha', async () => {
    const calls: string[] = [];
    await expect(
      flow.logoutBothSessions?.({
        logoutInternal: async () => {
          calls.push('manypost');
          throw new Error('internal failure');
        },
        logoutClerk: async () => {
          calls.push('clerk');
        },
      }),
    ).rejects.toThrow('internal failure');
    expect(calls).toEqual(['manypost', 'clerk']);
  });
});

describe('tarefas obrigatórias de sessão', () => {
  it('mantém a troca interna bloqueada até concluir uma tarefa Clerk conhecida', () => {
    expect(flow.sessionTaskPath?.('choose-organization')).toBe(
      '/session-tasks/choose-organization',
    );
    expect(flow.sessionTaskPath?.('reset-password')).toBe('/session-tasks/reset-password');
    expect(flow.sessionTaskPath?.('setup-mfa')).toBe('/session-tasks/setup-mfa');
    expect(flow.sessionTaskPath?.(undefined)).toBeNull();
  });
});

describe('falha na troca interna', () => {
  it('preserva a sessão Clerk somente quando o provider está indisponível', () => {
    expect(flow.exchangeFailureAction?.({ title: 'auth.provider_unavailable' })).toBe('retry');
    expect(flow.exchangeFailureAction?.({ title: 'auth.unauthorized' })).toBe('sign-out');
  });
});
