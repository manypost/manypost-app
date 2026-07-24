import { api } from '@/lib/api/client';

export type SignInAction = 'complete' | 'additional-verification' | 'incomplete';
export type SignUpAction = 'complete' | 'verify-email' | 'incomplete';
export type ExchangeFailureAction = 'retry' | 'sign-out';

export function exchangeFailureAction(error: unknown): ExchangeFailureAction {
  return (error as { title?: string } | null)?.title === 'auth.provider_unavailable'
    ? 'retry'
    : 'sign-out';
}

export function sessionTaskPath(key: string | undefined): string | null {
  if (!key) return null;
  if (key === 'choose-organization' || key === 'reset-password' || key === 'setup-mfa') {
    return `/session-tasks/${key}`;
  }
  return '/session-tasks/unsupported';
}

export function clerkSsoRequest(mode: 'sign-in' | 'sign-up') {
  return {
    mode,
    strategy: 'oauth_google' as const,
    redirectUrl: '/auth/complete',
    redirectCallbackUrl: '/sso-callback',
  };
}

export async function logoutBothSessions(input: {
  logoutInternal: () => Promise<void>;
  logoutClerk: () => Promise<void>;
}) {
  let failure: unknown;
  try {
    await input.logoutInternal();
  } catch (error) {
    failure = error;
  } finally {
    await input.logoutClerk();
  }
  if (failure) throw failure;
}

export function signInAction(status: string): SignInAction {
  if (status === 'complete') return 'complete';
  if (status === 'needs_second_factor' || status === 'needs_client_trust') {
    return 'additional-verification';
  }
  return 'incomplete';
}

export function signUpAction(input: {
  status: string;
  missingFields: string[];
  unverifiedFields: string[];
}): SignUpAction {
  if (input.status === 'complete') return 'complete';
  if (
    input.status === 'missing_requirements' &&
    input.missingFields.length === 0 &&
    input.unverifiedFields.includes('email_address')
  ) {
    return 'verify-email';
  }
  return 'incomplete';
}

interface ExchangeResult {
  isNewUser: boolean;
}

interface ExchangeInput {
  getToken: () => Promise<string | null>;
  request?: (token: string) => Promise<ExchangeResult>;
}

let exchanging: Promise<ExchangeResult> | null = null;

const requestExchange = async (token: string): Promise<ExchangeResult> => {
  const { data, error } = await api.POST('/v1/auth/clerk/exchange', {
    headers: { authorization: `Bearer ${token}` },
  });
  if (error || !data) throw error ?? new Error('troca de sessão Clerk falhou');
  return { isNewUser: data.isNewUser };
};

export function exchangeClerkSession(input: ExchangeInput): Promise<ExchangeResult> {
  exchanging ??= input
    .getToken()
    .then((token) => {
      if (!token) throw new Error('sessão Clerk ausente');
      return (input.request ?? requestExchange)(token);
    })
    .finally(() => {
      exchanging = null;
    });
  return exchanging;
}
