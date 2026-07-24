import { describe, expect, it } from 'bun:test';

type AuthFlowModule = {
  signInAction?: (status: string) => string;
  signUpAction?: (input: {
    status: string;
    missingFields: string[];
    unverifiedFields: string[];
  }) => string;
  clerkSsoRequest?: (mode: 'sign-in' | 'sign-up') => {
    mode: 'sign-in' | 'sign-up';
    strategy: string;
    redirectUrl: string;
    redirectCallbackUrl: string;
  };
  logoutClerkSession?: (input: {
    logoutClerk: () => Promise<void>;
  }) => Promise<void>;
  sessionTaskPath?: (key: string | undefined) => string | null;
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

describe('Google OAuth e logout', () => {
  it('inicia o Google pelo Clerk e retorna pelos callbacks internos', () => {
    expect(flow.clerkSsoRequest?.('sign-up')).toEqual({
      mode: 'sign-up',
      strategy: 'oauth_google',
      redirectUrl: '/auth/complete?de=%2Fboas-vindas',
      redirectCallbackUrl: '/sso-callback',
    });
    expect(flow.clerkSsoRequest?.('sign-in').redirectUrl).toBe('/auth/complete');
  });

  it('encerra somente a sessão Clerk', async () => {
    const calls: string[] = [];
    expect(flow.logoutClerkSession).toBeFunction();
    await flow.logoutClerkSession?.({
      logoutClerk: async () => {
        calls.push('clerk');
      },
    });
    expect(calls).toEqual(['clerk']);
  });
});

describe('tarefas obrigatórias de sessão', () => {
  it('mantém o acesso ao app bloqueado até concluir uma tarefa Clerk conhecida', () => {
    expect(flow.sessionTaskPath?.('choose-organization')).toBe(
      '/session-tasks/choose-organization',
    );
    expect(flow.sessionTaskPath?.('reset-password')).toBe('/session-tasks/reset-password');
    expect(flow.sessionTaskPath?.('setup-mfa')).toBe('/session-tasks/setup-mfa');
    expect(flow.sessionTaskPath?.(undefined)).toBeNull();
  });
});
