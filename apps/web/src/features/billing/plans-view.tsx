'use client';

import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useApiErrorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import {
  type BillingPeriod,
  type PlanTier,
  useBilling,
  useBillingPortal,
  useCapabilities,
  useCheckout,
  useInvoices,
  usePlanCatalog,
  useSyncSubscription,
  useToggleCancel,
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

const UNLIMITED = -1;

const shortDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });

/** Medidor de uso em linha — só desenha a barra quando existe teto. */
function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const t = useTranslations('billing');
  const unlimited = limit === UNLIMITED;
  const full = !unlimited && used >= limit;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-graphite">{label}</span>
      <span className={cn('text-xs font-semibold tabular-nums', full ? 'text-state-failed' : 'text-ink')}>
        {used}/{unlimited ? '∞' : limit}
      </span>
      {unlimited ? (
        <span className="sr-only">{t('unlimited')}</span>
      ) : (
        <span className="h-1 w-16 overflow-hidden rounded-sm bg-surface-2">
          <span
            className={cn('block h-full', full ? 'bg-state-failed' : 'bg-accent')}
            style={{ width: `${Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))}%` }}
          />
        </span>
      )}
    </div>
  );
}

/**
 * Planos e assinatura. Mesma leitura do onboarding: três cartões de preço e, abaixo, o que
 * o plano escolhido inclui — em vez de uma matriz que exige decifrar. O estado da assinatura
 * vem primeiro, em faixa, porque é o que quem já assina abre a página para ver.
 */
export function PlansView() {
  const t = useTranslations('billing');
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const params = useSearchParams();

  const capabilities = useCapabilities();
  const catalog = usePlanCatalog();
  const billing = useBilling();
  const invoices = useInvoices();
  const checkout = useCheckout();
  const portal = useBillingPortal();
  const toggleCancel = useToggleCancel();
  const sync = useSyncSubscription();

  const [period, setPeriod] = useState<BillingPeriod>('YEARLY');
  const [picked, setPicked] = useState<PlanTier | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const billingEnabled = capabilities.data?.billingEnabled ?? false;
  const plan = billing.data?.plan ?? capabilities.data?.plan;
  const subscription = billing.data?.subscription ?? null;
  const tier = (plan?.tier ?? 'FREE') as PlanTier;
  // quem está no Grátis abre a página já vendo o Pro; quem assina vê o próprio plano
  const selected = picked ?? (tier === 'FREE' ? 'PRO' : tier);

  const back = params.get('assinatura');
  const canceledCheckout = params.get('cancelado');
  useEffect(() => {
    if (!billingEnabled) return;
    if (back) {
      sync.mutate(undefined, { onSuccess: () => toast.success(t('checkoutBack', { plan: 'manypost' })) });
      router.replace('/planos');
    } else if (canceledCheckout) {
      toast.info(t('checkoutCanceled'));
      router.replace('/planos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [back, canceledCheckout, billingEnabled]);

  if (capabilities.isPending) return <Skeleton className="h-72 rounded-lg" />;

  if (!billingEnabled) {
    return (
      <div className="flex max-w-2xl flex-col gap-2 rounded-lg border border-line bg-surface p-5">
        <h1 className="font-display text-base font-bold tracking-[-0.2px] text-ink">
          {t('selfHostedTitle')}
        </h1>
        <p className="text-[13px] leading-relaxed text-graphite">{t('selfHostedBody')}</p>
      </div>
    );
  }

  const priceOf = (target: PlanTier, p: BillingPeriod) =>
    catalog.data?.plans.find((x) => x.tier === target)?.prices[p] ?? null;

  const selectedPrice = priceOf(selected, period);
  const isCurrent = selected === tier;

  const subscribe = () => {
    if (selected === 'FREE') return;
    checkout.mutate(
      { tier: selected as 'PRO' | 'PREMIUM', period },
      {
        onSuccess: (data) => {
          if (data.url) window.location.href = data.url;
          else if (data.portalUrl) window.location.href = data.portalUrl;
          else toast.success(t('planChanged'));
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const statusLabel: Record<string, string> = {
    ACTIVE: t('statusActive'),
    TRIALING: t('statusTrialing'),
    PAST_DUE: t('statusPastDue'),
    CANCELED: t('statusCanceled'),
    INCOMPLETE: t('statusIncomplete'),
  };

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      {/* faixa de status: plano, prazo, uso e ações numa linha só */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-line bg-surface px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Badge variant={subscription?.status === 'PAST_DUE' ? 'failed' : 'accent'}>
            {subscription ? statusLabel[subscription.status] : PLAN_LABEL.FREE}
          </Badge>
          {subscription?.cancelAt ? (
            <span className="text-xs text-graphite">
              {t('endsAt', { date: shortDate(subscription.cancelAt, locale) })}
            </span>
          ) : subscription?.currentPeriodEnd ? (
            <span className="text-xs text-graphite">
              {t('renewsAt', { date: shortDate(subscription.currentPeriodEnd, locale) })}
            </span>
          ) : null}
        </div>

        <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
        <UsageMeter
          label={t('usageChannels')}
          used={plan?.usage.channels ?? 0}
          limit={plan?.limits.channels ?? UNLIMITED}
        />
        <UsageMeter
          label={t('usagePosts')}
          used={plan?.usage.postsThisMonth ?? 0}
          limit={plan?.limits.postsPerMonth ?? UNLIMITED}
        />

        {subscription ? (
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              isLoading={portal.isPending}
              onClick={() =>
                portal.mutate(undefined, {
                  onSuccess: (data) => {
                    window.location.href = data.url;
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              {t('manage')}
            </Button>
            {subscription.cancelAt ? (
              <Button
                variant="ghost"
                size="sm"
                isLoading={toggleCancel.isPending}
                onClick={() =>
                  toggleCancel.mutate(
                    {},
                    {
                      onSuccess: () => toast.success(t('resumed')),
                      onError: (err) => toast.error(errorMessage(err)),
                    },
                  )
                }
              >
                {t('resume')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-state-failed hover:text-state-failed"
                onClick={() => setCancelOpen(true)}
              >
                {t('cancel')}
              </Button>
            )}
          </div>
        ) : null}
      </section>

      {subscription?.status === 'PAST_DUE' ? (
        <p className="rounded-md border border-state-failed bg-state-failed-tint px-3 py-2 text-[13px] text-state-failed">
          {t('pastDueHint')}
        </p>
      ) : null}

      {/* escolha do plano — mesma leitura do onboarding */}
      <section className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-[13px] leading-relaxed text-graphite">{t('subheadline')}</p>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>

        {catalog.isPending ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {TIERS.map((target) => (
              <Skeleton key={target} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('title')}>
            {TIERS.map((target) => (
              <PlanPickerCard
                key={target}
                tier={target}
                price={priceOf(target, period)}
                period={period}
                selected={selected === target}
                current={tier === target}
                onSelect={() => setPicked(target)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-line pt-5">
          <PlanIncludes tier={selected} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-graphite">
              {isCurrent
                ? t('currentPlanHint')
                : selected === 'FREE'
                  ? t('downgradeHint')
                  : t('footerPaid', {
                      price: brl(displayPrice(selectedPrice ?? 0, period)),
                      billed:
                        period === 'YEARLY'
                          ? t('perYear', { total: brl(selectedPrice ?? 0) })
                          : t('billedMonthlyShort'),
                    })}
            </p>
            {!isCurrent && selected !== 'FREE' ? (
              <Button isLoading={checkout.isPending} onClick={subscribe}>
                {tier === 'FREE'
                  ? t('choosePlan', { plan: PLAN_LABEL[selected] })
                  : t('switchPlan', { plan: PLAN_LABEL[selected] })}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {/* faturas */}
      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">
          {t('invoicesTitle')}
        </h2>
        {invoices.isPending ? (
          <Skeleton className="m-4 h-10 rounded-md" />
        ) : (invoices.data ?? []).length === 0 ? (
          <p className="px-5 py-3.5 text-[13px] text-graphite">{t('noInvoices')}</p>
        ) : (
          <ul>
            {invoices.data!.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 text-[13px] text-graphite">
                  {shortDate(invoice.createdAt, locale)}
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-ink">
                  {brl(invoice.amountPaid)}
                </span>
                {invoice.invoiceUrl ? (
                  <a
                    href={invoice.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[13px] text-accent underline-offset-4 transition-colors duration-200 hover:text-accent-hover hover:underline"
                  >
                    {t('invoiceReceipt')}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('cancelWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel-feedback">{t('cancelFeedbackLabel')}</Label>
            <Textarea
              id="cancel-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              isLoading={toggleCancel.isPending}
              onClick={() =>
                toggleCancel.mutate(feedback.trim() ? { feedback: feedback.trim() } : {}, {
                  onSuccess: (data) => {
                    toast.success(
                      data.canceledImmediately || !data.cancelAt
                        ? t('cancelImmediate')
                        : t('cancelScheduled', { date: shortDate(data.cancelAt, locale) }),
                    );
                    setCancelOpen(false);
                    setFeedback('');
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              {t('cancel')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
