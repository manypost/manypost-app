'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePlanFeatures } from './hooks';

const PLAN_LABEL: Record<string, string> = { PRO: 'Pro', PREMIUM: 'Premium' };

/**
 * Aviso inline de feature travada pelo plano. Não renderiza nada quando a feature está
 * liberada — inclusive em self-hosted, onde `enforced` é false e tudo passa.
 */
export function PlanLockNotice({
  feature,
  requiredTier = 'PRO',
}: {
  feature: string;
  requiredTier?: 'PRO' | 'PREMIUM';
}) {
  const t = useTranslations('billing');
  const { has, billingEnabled } = usePlanFeatures();
  if (!billingEnabled || has(feature)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent bg-accent-tint px-3 py-2 text-[13px] text-accent">
      <Lock className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        {t('lockedFeature', { plan: PLAN_LABEL[requiredTier] ?? requiredTier })}
      </span>
      <Link
        href="/planos"
        className="font-semibold underline-offset-4 transition-colors duration-200 hover:text-accent-hover hover:underline"
      >
        {t('seePlans')}
      </Link>
    </div>
  );
}

/** `true` quando a feature está travada — para desabilitar botões junto com o aviso. */
export function usePlanLocked(feature: string): boolean {
  const { has, billingEnabled } = usePlanFeatures();
  return billingEnabled && !has(feature);
}
