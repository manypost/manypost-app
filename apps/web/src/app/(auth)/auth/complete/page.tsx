import { ClerkSessionComplete } from '@/features/auth/clerk-session-complete';

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AuthCompletePage({ searchParams }: { searchParams: Search }) {
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
