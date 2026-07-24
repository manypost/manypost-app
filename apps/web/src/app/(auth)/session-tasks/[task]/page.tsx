import { redirect } from 'next/navigation';
import { ClerkSessionTask } from '@/features/auth/clerk-session-task';

type Params = Promise<{ task: string }>;

export default async function SessionTaskPage({ params }: { params: Params }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect('/login');
  const { task } = await params;
  return <ClerkSessionTask task={task} />;
}
