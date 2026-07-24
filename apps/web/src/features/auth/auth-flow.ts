export type SignInAction = 'complete' | 'additional-verification' | 'incomplete';
export type SignUpAction = 'complete' | 'verify-email' | 'incomplete';

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
    redirectUrl:
      mode === 'sign-up' ? '/auth/complete?de=%2Fboas-vindas' : '/auth/complete',
    redirectCallbackUrl: '/sso-callback',
  };
}

export async function logoutClerkSession(input: {
  logoutClerk: () => Promise<void>;
}) {
  await input.logoutClerk();
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
