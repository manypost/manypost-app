import { ClerkSessionComplete } from '@/features/auth/clerk-session-complete';
import { redirect } from 'next/navigation';

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AuthCompletePage({ searchParams }: { searchParams: Search }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect('/login');
  const params = await searchParams;
  const rawDestination = params.de;
  const destination =
    typeof rawDestination === 'string' &&
    rawDestination.startsWith('/') &&
    !rawDestination.startsWith('//')
      ? rawDestination
      : '/calendario';
  return <ClerkSessionComplete destination={destination} />;
}
