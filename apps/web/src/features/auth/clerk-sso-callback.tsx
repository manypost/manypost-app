'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export function ClerkSsoCallback() {
  return <AuthenticateWithRedirectCallback />;
}
