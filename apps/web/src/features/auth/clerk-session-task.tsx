'use client';

import {
  TaskChooseOrganization,
  TaskResetPassword,
  TaskSetupMFA,
  useClerk,
} from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export function ClerkSessionTask({ task }: { task: string }) {
  const clerk = useClerk();
  if (task === 'choose-organization') {
    return <TaskChooseOrganization redirectUrlComplete="/auth/complete" />;
  }
  if (task === 'reset-password') {
    return <TaskResetPassword redirectUrlComplete="/auth/complete" />;
  }
  if (task === 'setup-mfa') {
    return <TaskSetupMFA redirectUrlComplete="/auth/complete" />;
  }
  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-sm text-graphite">
        Esta conta exige uma etapa de segurança ainda não suportada.
      </p>
      <Button type="button" onClick={() => clerk.signOut({ redirectUrl: '/login' })}>
        Voltar ao login
      </Button>
    </div>
  );
}
