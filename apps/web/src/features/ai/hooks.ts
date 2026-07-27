'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useCapabilities, usePlanFeatures } from '@/features/billing/hooks';

/**
 * Superfície de IA no web (SPEC_AI §5.2).
 *
 * Duas condições independentes decidem o que aparece:
 *  - **a instalação tem IA?** (`capabilities.ai.enabled`) — sem provedor configurado a
 *    superfície some inteira, em vez de oferecer botão que responderia 404;
 *  - **o plano inclui?** (`has('ai_caption')`) — aqui o botão aparece, e clicar leva ao CTA
 *    de upgrade. Esconder features pagas é pior para conversão do que mostrá-las travadas.
 */
export function useAiAvailability() {
  const capabilities = useCapabilities();
  const plan = usePlanFeatures();
  const ai = capabilities.data?.ai;

  return {
    isLoading: capabilities.isPending,
    /** esta instalação tem provedor de IA configurado */
    enabled: ai?.enabled ?? false,
    /** o modelo configurado enxerga imagem (alt-text automático) */
    canDescribeImages: ai?.canDescribeImages ?? false,
    credits: ai?.credits ?? null,
    /** franquia esgotada — a UI avisa antes do clique em vez de deixar dar 402 */
    exhausted: Boolean(ai?.credits?.enforced && (ai.credits.remaining ?? 0) <= 0),
    hasCaption: plan.has('ai_caption'),
    hasBestTime: plan.has('ai_best_time'),
    hasDraft: plan.has('ai_multichannel_draft'),
    hasCalendar: plan.has('ai_calendar'),
  };
}

/** a franquia muda a cada geração — o saldo mostrado tem de acompanhar */
function useInvalidateCredits() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['capabilities'] });
}

export interface AiVariant {
  channelId: string;
  text: string;
  maxLength: number;
  shortened: boolean;
}

export function useGenerateCaption() {
  const refresh = useInvalidateCredits();
  return useMutation({
    mutationFn: async (input: {
      brief: string;
      channelIds: string[];
      tone?: string;
      settings?: Record<string, unknown>;
    }) => {
      const { data, error } = await api.POST('/v1/ai/caption', { body: input });
      if (error) throw error;
      return data.variants as AiVariant[];
    },
    onSettled: refresh,
  });
}

/** ids do catálogo de instruções do servidor — o rótulo vem do catálogo de mensagens */
export const REWRITE_IDS = [
  'shorten',
  'expand',
  'formal',
  'casual',
  'with_emoji',
  'without_emoji',
  'fix_grammar',
] as const;
export type RewriteId = (typeof REWRITE_IDS)[number];

/** as duas primeiras corrigem/ajustam; as outras mudam o tom — separadas no menu */
export const REWRITE_TONE_IDS: RewriteId[] = ['formal', 'casual', 'with_emoji', 'without_emoji'];
export const REWRITE_EDIT_IDS: RewriteId[] = ['fix_grammar', 'shorten', 'expand'];

export interface RewriteResult {
  channelId: string | null;
  text: string;
  maxLength: number | null;
  /** true = passou do limite do canal, e NADA foi removido por isso */
  overLimit: boolean;
}

/**
 * Reescrita. `channelId` é **opcional** de propósito: na aba global o texto é compartilhado por
 * várias redes e não existe canal único a resolver — mandar o primeiro impunha o limite de uma
 * rede não relacionada e devolvia o texto cortado.
 */
export function useRewriteText() {
  const refresh = useInvalidateCredits();
  return useMutation({
    mutationFn: async (input: {
      text: string;
      instructionId: RewriteId;
      channelId?: string;
      settings?: Record<string, unknown>;
    }) => {
      const { data, error } = await api.POST('/v1/ai/rewrite', { body: input });
      if (error) throw error;
      return data as RewriteResult;
    },
    onSettled: refresh,
  });
}

export function useSuggestHashtags() {
  const refresh = useInvalidateCredits();
  return useMutation({
    mutationFn: async (input: { text: string; channelId: string; count?: number }) => {
      const { data, error } = await api.POST('/v1/ai/hashtags', { body: input });
      if (error) throw error;
      return data.hashtags as string[];
    },
    onSettled: refresh,
  });
}

export function useGenerateAltText() {
  const refresh = useInvalidateCredits();
  return useMutation({
    mutationFn: async (input: { mediaId: string; context?: string }) => {
      const { data, error } = await api.POST('/v1/ai/alt-text', { body: input });
      if (error) throw error;
      return data.alt as string;
    },
    onSettled: refresh,
  });
}

export function useDraftMultichannel() {
  const refresh = useInvalidateCredits();
  return useMutation({
    mutationFn: async (input: { idea: string; channelIds: string[]; tone?: string }) => {
      const { data, error } = await api.POST('/v1/ai/draft', { body: input });
      if (error) throw error;
      return data.drafts as AiVariant[];
    },
    onSettled: refresh,
  });
}

export interface BestTimeSlot {
  weekday: number;
  hour: number;
  score: number;
}

/**
 * Sugestão de horário. Não consome franquia e não depende de provedor de IA — por isso é
 * `useQuery` (pode rodar sozinha ao abrir o agendamento) e não `useMutation`.
 */
export function useBestTimes(channelId: string | undefined, enabled: boolean) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery({
    queryKey: ['ai', 'best-times', channelId, timezone],
    enabled: Boolean(channelId) && enabled,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await api.GET('/v1/ai/best-times', {
        params: { query: { channelId: channelId!, timezone } },
      });
      if (error) throw error;
      return data as {
        channelId: string;
        timezone: string;
        slots: BestTimeSlot[];
        confidence: 'low' | 'medium' | 'high';
        sampleSize: number;
        fromBaseline: boolean;
        /**
         * O que sustenta a resposta. `own_posting_history` são os horários que a organização
         * MAIS USA — não uma medição de desempenho. A frase da interface sai daqui, para não
         * insinuar medição que a plataforma ainda não coleta.
         */
        signal: 'network_baseline' | 'own_posting_history' | 'own_engagement';
      };
    },
  });
}
