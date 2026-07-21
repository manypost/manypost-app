'use client';

import {
  BadgeCheck,
  Check,
  ChevronDown,
  CreditCard,
  PartyPopper,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiErrorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import {
  type BillingPeriod,
  type PlanTier,
  useCapabilities,
  useCheckout,
  usePlanCatalog,
} from './hooks';
import {
  PLAN_LABEL,
  PeriodToggle,
  PlanIncludes,
  PlanPickerCard,
  TIERS,
  brl,
  displayPrice,
} from './plan-picker';

function TrustItem({ icon: Icon, children }: { icon: typeof Check; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-tint">
        <Icon className="size-3.5 text-accent" aria-hidden />
      </span>
      <span className="text-sm leading-snug text-ink-soft">{children}</span>
    </li>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-line bg-surface px-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3 text-left outline-none transition-colors duration-200 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="text-sm font-semibold text-ink">{question}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-graphite transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? <p className="pb-3.5 text-[13px] leading-relaxed text-graphite">{answer}</p> : null}
    </div>
  );
}

/**
 * Onboarding pós-cadastro. Estrutura seguindo a referência do Postiz (docs/references for
 * postiz): split de duas colunas ocupando a tela inteira, separadas por régua vertical —
 * argumento à esquerda, escolha do plano à direita, barra de conversão fixa embaixo.
 * Diferença essencial: o manypost TEM plano Grátis, então a saída "Continuar no Grátis"
 * existe sempre. Em self-hosted a tela nem aparece (vai direto para /conexoes).
 */
export function OnboardingView() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const errorMessage = useApiErrorMessage();

  const capabilities = useCapabilities();
  const catalog = usePlanCatalog();
  const checkout = useCheckout();

  const [period, setPeriod] = useState<BillingPeriod>('YEARLY');
  const [selected, setSelected] = useState<PlanTier>('PRO');

  const billingEnabled = capabilities.data?.billingEnabled ?? false;
  const faq = t.raw('faq') as Array<{ q: string; a: string }>;

  useEffect(() => {
    if (!capabilities.isPending && !billingEnabled) router.replace('/conexoes');
  }, [capabilities.isPending, billingEnabled, router]);

  if (capabilities.isPending || !billingEnabled) {
    return <Skeleton className="m-6 h-96 rounded-lg" />;
  }

  const priceOf = (tier: PlanTier, p: BillingPeriod) =>
    catalog.data?.plans.find((x) => x.tier === tier)?.prices[p] ?? null;

  const selectedPrice = priceOf(selected, period);
  const goFree = () => router.replace('/conexoes');
  const subscribe = () => {
    if (selected === 'FREE') return goFree();
    checkout.mutate(
      { tier: selected as 'PRO' | 'PREMIUM', period },
      {
        onSuccess: (data) => {
          if (data.url) window.location.href = data.url;
          else if (data.portalUrl) window.location.href = data.portalUrl;
          else router.replace('/conexoes');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="mx-auto grid max-w-[1600px] pb-24 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {/* ---------------- argumento ---------------- */}
      <div className="flex flex-col gap-7 px-5 py-8 md:px-10 lg:py-12">
        <div className="flex flex-col gap-3">
          <span className="flex w-fit items-center gap-1.5 rounded-sm bg-accent-tint px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
            <PartyPopper className="size-3.5" aria-hidden />
            {t('welcome')}
          </span>
          <h1 className="max-w-3xl font-display text-3xl font-bold leading-[1.1] tracking-[-1px] text-ink md:text-[40px]">
            Uma marca, <span className="text-accent">todas as suas redes.</span>
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-graphite">{t('subheadline')}</p>
        </div>

        {/* selos de confiança numa linha só, ocupando a largura (padrão da referência) */}
        <ul className="flex flex-wrap gap-x-8 gap-y-3 border-y border-line py-4">
          <TrustItem icon={CreditCard}>{t('trust.free')}</TrustItem>
          <TrustItem icon={ShieldCheck}>{t('trust.cancel')}</TrustItem>
          <TrustItem icon={BadgeCheck}>{t('trust.official')}</TrustItem>
        </ul>

        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-tint">
            <TrendingDown className="size-4.5 text-accent" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-semibold text-ink">{t('compareTitle')}</p>
            <p className="text-[13px] leading-relaxed text-graphite">{t('compareBody')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold tracking-[-0.3px] text-ink">
            {t('faqTitle')}
          </h2>
          <div className="grid gap-2 xl:grid-cols-2">
            {faq.map((item) => (
              <FaqItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- escolha do plano ---------------- */}
      <aside className="flex flex-col gap-5 border-t border-line bg-canvas px-5 py-8 md:px-10 lg:border-l lg:border-t-0 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-[-0.4px] text-ink">
            {t('chooseTitle')}
          </h2>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>

        {catalog.isPending ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <Skeleton key={tier} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('chooseTitle')}>
            {TIERS.map((tier) => (
              <PlanPickerCard
                key={tier}
                tier={tier}
                price={priceOf(tier, period)}
                period={period}
                selected={selected === tier}
                onSelect={() => setSelected(tier)}
              />
            ))}
          </div>
        )}

        <div className="border-t border-line pt-5">
          <PlanIncludes tier={selected} />
        </div>
      </aside>

      {/* ---------------- barra fixa de conversão ---------------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-5 py-3 md:px-10">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-[13px] leading-snug text-graphite">
            {selected === 'FREE' || !selectedPrice
              ? t('footerFree')
              : t('footerPaid', {
                  price: brl(displayPrice(selectedPrice, period)),
                  billed:
                    period === 'YEARLY'
                      ? t('billedYearly', { total: brl(selectedPrice) })
                      : t('billedMonthly'),
                })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {selected !== 'FREE' ? (
              <Button variant="ghost" onClick={goFree}>
                {t('continueFree')}
              </Button>
            ) : null}
            <Button size="lg" isLoading={checkout.isPending} onClick={subscribe}>
              {selected === 'FREE' ? t('startFree') : t('subscribe', { plan: PLAN_LABEL[selected] })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
