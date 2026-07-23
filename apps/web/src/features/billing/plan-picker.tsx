'use client';

import { Check, Rocket, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BillingPeriod, PlanTier } from './hooks';

export const TIERS: PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];
export const PLAN_LABEL: Record<PlanTier, string> = {
  FREE: 'Grátis',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};

export const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Preço exibido: no anual mostramos o equivalente mensal (o "R$ 23,90" da landing). */
export const displayPrice = (price: number, period: BillingPeriod) =>
  period === 'YEARLY' ? Math.round(price / 12) : price;

/** Alternador mensal/anual — mesmo controle nas duas telas. */
export function PeriodToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  const t = useTranslations('billing');
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-line bg-surface p-1" role="group">
      {(['MONTHLY', 'YEARLY'] as const).map((period) => (
        <button
          key={period}
          type="button"
          aria-pressed={value === period}
          onClick={() => onChange(period)}
          className={cn(
            'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold outline-none transition-colors duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            value === period ? 'bg-accent-tint text-accent' : 'text-graphite hover:text-ink',
          )}
        >
          {period === 'MONTHLY' ? t('monthly') : t('yearly')}
          {period === 'YEARLY' ? (
            <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-bold text-paper">
              {t('yearlyDiscount')}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Cartão de plano: nome, preço e como é cobrado — nada mais. O detalhe do plano vive na
 * lista `PlanIncludes` abaixo da grade, para o cartão continuar legível de relance.
 */
export function PlanPickerCard({
  tier,
  price,
  period,
  selected,
  current,
  onSelect,
}: {
  tier: PlanTier;
  price: number | null;
  period: BillingPeriod;
  selected: boolean;
  /** plano que a organização assina hoje */
  current?: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('billing');
  const to = useTranslations('onboarding');

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border px-4 py-3.5 text-left outline-none transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected
          ? 'bevel-accent'
          : 'bevel-surface hover:border-accent hover:bg-surface-2',
      )}
    >
      <span className="flex w-full items-center gap-1.5">
        <span className="text-sm font-semibold text-ink">{PLAN_LABEL[tier]}</span>
        {current ? (
          <Badge variant="solid" className="ml-auto">
            {t('currentPlan')}
          </Badge>
        ) : tier === 'PRO' ? (
          <Badge variant="solid" className="ml-auto">
            {to('recommended')}
          </Badge>
        ) : null}
      </span>

      <span className="flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold tracking-[-0.5px] text-ink">
          {price === null ? 'R$ 0' : brl(displayPrice(price, period))}
        </span>
        <span className="text-xs text-graphite">{price === null ? '' : t('perMonth')}</span>
      </span>

      <span className="text-xs leading-snug text-mist">
        {price === null
          ? t('freeForever')
          : period === 'YEARLY'
            ? t('perYear', { total: brl(price) })
            : t('billedMonthlyShort')}
      </span>
    </button>
  );
}

/** O que o plano inclui, em duas colunas — a mesma cópia da página de preços. */
export function PlanIncludes({ tier }: { tier: PlanTier }) {
  const t = useTranslations('onboarding');
  const plan = useTranslations(`billing.plans.${tier}`);
  const bullets = plan.raw('bullets') as string[];
  const excluded = (plan.raw('excluded') ?? []) as string[];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        {tier === 'FREE' ? (
          <Rocket className="size-4 text-accent" aria-hidden />
        ) : (
          <Sparkles className="size-4 text-accent" aria-hidden />
        )}
        {t('includes', { plan: PLAN_LABEL[tier] })}
      </h3>
      <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-[13px] leading-snug text-ink-soft">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            {bullet}
          </li>
        ))}
        {excluded.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-[13px] leading-snug text-mist">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center" aria-hidden>
              <span className="h-px w-2.5 bg-mist" />
            </span>
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}
