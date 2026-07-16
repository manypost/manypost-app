import type { Metadata } from 'next';
import { ApprovalView } from '@/features/approval/approval-view';

// página pública por token — nunca indexar (SPEC_FRONTEND §3.6)
export const metadata: Metadata = {
  title: 'Aprovação de publicação',
  robots: { index: false, follow: false },
};

export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ApprovalView token={token} />;
}
