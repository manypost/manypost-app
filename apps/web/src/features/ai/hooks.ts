'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
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
    /** o provedor configurado DESENHA — sem isto a geração de imagem some da interface */
    canGenerateImages: ai?.canGenerateImages ?? false,
    credits: ai?.credits ?? null,
    /** franquia esgotada — a UI avisa antes do clique em vez de deixar dar 402 */
    exhausted: Boolean(ai?.credits?.enforced && (ai.credits.remaining ?? 0) <= 0),
    hasCaption: plan.has('ai_caption'),
    hasBestTime: plan.has('ai_best_time'),
    hasDraft: plan.has('ai_multichannel_draft'),
    hasCalendar: plan.has('ai_calendar'),
    hasImage: plan.has('ai_image'),
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

/**
 * Proporções oferecidas — as mesmas do contrato. O rótulo é humano ("Retrato"), não a razão crua:
 * quem escreve um post pensa em "formato do feed", não em 4:5.
 */
export const ASPECTOS = [
  { id: '1:1', labelKey: 'aspect1x1' },
  { id: '4:5', labelKey: 'aspect4x5' },
  { id: '9:16', labelKey: 'aspect9x16' },
  { id: '16:9', labelKey: 'aspect16x9' },
  { id: '1.91:1', labelKey: 'aspect191x1' },
] as const;

export type AspectId = (typeof ASPECTOS)[number]['id'];

export const IMAGE_MODE_OPTIONS = [
  {
    id: 'economy',
    credits: 2,
    labelKey: 'imageModeEconomy',
    descriptionKey: 'imageModeEconomyDescription',
  },
  {
    id: 'quality',
    credits: 5,
    labelKey: 'imageModeQuality',
    descriptionKey: 'imageModeQualityDescription',
  },
] as const;

export type ImageModeId = (typeof IMAGE_MODE_OPTIONS)[number]['id'];

export interface GeneratedMedia {
  id: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  source: string;
}

export interface GenerateImageInput {
  prompt: string;
  aspect?: AspectId;
  channelId?: string;
  mode?: ImageModeId;
  alt?: string;
}

const imageRequestFingerprint = (input: GenerateImageInput) =>
  JSON.stringify([
    input.prompt.trim(),
    input.aspect ?? null,
    input.channelId ?? null,
    input.mode ?? null,
    input.alt?.trim() || null,
  ]);

export interface ImageIdempotencyTracker {
  keyFor(input: GenerateImageInput): string;
  complete(input: GenerateImageInput): void;
}

/**
 * Mantém a chave depois de erro: se o servidor concluiu e só a resposta se perdeu, "tentar de
 * novo" precisa obter o replay. Sucesso limpa a chave para "gerar outra" ser uma ação nova.
 */
export function createImageIdempotencyTracker(
  makeKey: () => string = () => crypto.randomUUID(),
): ImageIdempotencyTracker {
  let current: { fingerprint: string; key: string } | undefined;
  return {
    keyFor(input) {
      const fingerprint = imageRequestFingerprint(input);
      if (current?.fingerprint !== fingerprint) {
        current = { fingerprint, key: makeKey() };
      }
      return current.key;
    },
    complete(input) {
      if (current?.fingerprint === imageRequestFingerprint(input)) current = undefined;
    },
  };
}

export const imageGenerationRequest = (
  input: GenerateImageInput,
  tracker: ImageIdempotencyTracker,
) => ({
  body: input,
  headers: { 'Idempotency-Key': tracker.keyFor(input) },
});

/**
 * Geração de imagem (`ai_image`, Premium — 2 créditos em economia, 5 em qualidade).
 *
 * Invalida a biblioteca de mídia junto com a franquia: a imagem nasce lá dentro, e a lista
 * precisa mostrá-la sem um F5.
 */
export function useGenerateImage() {
  const queryClient = useQueryClient();
  const trackerRef = useRef<ImageIdempotencyTracker | null>(null);
  if (!trackerRef.current) trackerRef.current = createImageIdempotencyTracker();
  const tracker = trackerRef.current;
  return useMutation({
    mutationFn: async (input: GenerateImageInput) => {
      const { data, error } = await api.POST(
        '/v1/ai/image',
        imageGenerationRequest(input, tracker),
      );
      if (error) throw error;
      return data.media as GeneratedMedia;
    },
    onSuccess: (_data, input) => tracker.complete(input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['capabilities'] });
      void queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
}
