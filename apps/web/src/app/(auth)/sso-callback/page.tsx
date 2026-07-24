import { redirect } from 'next/navigation';
import { ClerkSsoCallback } from '@/features/auth/clerk-sso-callback';

export default function SsoCallbackPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect('/login');
  return <ClerkSsoCallback />;
}
