'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM';
export type BillingPeriod = 'MONTHLY' | 'YEARLY';

/**
 * O que ESTA instalação libera para ESTA organização. Existe sempre — em self-hosted volta
 * `billingEnabled: false` com tudo liberado, e a UI esconde qualquer menção a cobrança.
 */
export function useCapabilities() {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/capabilities');
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

/** Atalho para gatear a UI: `has('approval_link')` e o plano mínimo do CTA de upgrade. */
export function usePlanFeatures() {
  const capabilities = useCapabilities();
  const plan = capabilities.data?.plan;
  return {
    isLoading: capabilities.isPending,
    billingEnabled: capabilities.data?.billingEnabled ?? false,
    tier: (plan?.tier ?? 'PREMIUM') as PlanTier,
    enforced: plan?.enforced ?? false,
    usage: plan?.usage,
    limits: plan?.limits,
    /** sem enforcement (self-hosted) tudo é liberado */
    has: (feature: string) => !plan?.enforced || (plan?.features ?? []).includes(feature),
  };
}

export function usePlanCatalog() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/billing/plans');
      if (error) throw error;
      return data;
    },
    staleTime: 300_000,
  });
}

export function useBilling() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/billing');
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/billing/invoices');
      if (error) throw error;
      return data;
    },
  });
}

/** Assina (Checkout hospedado) ou troca o plano de quem já assina (proration). */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tier: 'PRO' | 'PREMIUM'; period: BillingPeriod }) => {
      const { data, error } = await api.POST('/v1/billing/checkout', { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.GET('/v1/billing/portal');
      if (error) throw error;
      return data;
    },
  });
}

/** Cancela ao fim do período; chamar de novo reativa a assinatura. */
export function useToggleCancel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { feedback?: string }) => {
      const { data, error } = await api.POST('/v1/billing/cancel', { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
  });
}

/** Reconcilia com a Stripe na volta do checkout (o webhook pode ainda não ter chegado). */
export function useSyncSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/v1/billing/sync', {});
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
