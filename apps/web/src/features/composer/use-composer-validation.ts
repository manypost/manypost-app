'use client';

import { useTranslations } from 'next-intl';
import { useChannels, useProviders } from '@/features/channels/hooks';
import { useMediaList } from '@/features/media/hooks';
import type { components } from '@/lib/api/schema';
import {
  useComposerChannelIds,
  useComposerChannelSettings,
  useComposerMediaIds,
  useComposerOverrides,
  useComposerPublishAtLocal,
  useComposerText,
  useComposerThread,
} from './composer-selectors';
import {
  type ChannelCounter,
  type ComposerIssue,
  type Traduz,
  computeCounters,
  computeIssues,
  computeMinMax,
  computeScheduleIssues,
} from './validation';

type Channel = components['schemas']['Channel'];
type ProviderInfo = components['schemas']['ChannelProviderInfo'];

export interface ComposerValidacao {
  /** canais do rascunho que ainda existem, na ordem de exibição */
  selected: Channel[];
  /** total de canais conectados — o cabeçalho de seleção diz "3 de 7" */
  totalCanais: number;
  counters: ChannelCounter[];
  /** limite mais apertado entre os selecionados; vale para os itens de thread */
  minMax: number | undefined;
  /** o que trava qualquer publicação */
  issues: ComposerIssue[];
  /** o que trava só o agendamento (publicar agora segue liberado) */
  scheduleIssues: ComposerIssue[];
  publishAt: Date | null;
  threadSuportada: boolean;
  threadNaoSuportada: string[];
  providerOf: (providerId: string) => ProviderInfo | undefined;
}

/**
 * Canais do rascunho que ainda existem, na ordem de exibição.
 *
 * Exportado à parte porque quase toda folha precisa DISTO e não da validação inteira: assinar
 * `useComposerValidation` só para saber quais canais estão escolhidos traria junto texto,
 * overrides e thread — ou seja, um re-render por tecla de graça.
 */
export function useCanaisSelecionados(): Channel[] {
  const channels = useChannels();
  const channelIds = useComposerChannelIds();
  return (channels.data ?? []).filter((ch) => channelIds.includes(ch.id));
}

/**
 * Suporte a thread entre os canais escolhidos. Depende só do catálogo e da seleção — quem
 * precisa disto (a seção de réplicas) não deve re-renderizar a cada tecla do post principal.
 */
export function useSuporteAThread() {
  const providers = useProviders();
  const selected = useCanaisSelecionados();
  const aceita = (ch: Channel) =>
    providers.data?.find((p) => p.id === ch.provider)?.threads ?? false;
  return {
    threadSuportada: selected.length > 0 && selected.every(aceita),
    threadNaoSuportada: selected
      .filter((ch) => !aceita(ch))
      .map((ch) => ch.name ?? ch.username ?? ch.id),
  };
}

/**
 * Junta store + catálogo e roda a validação pura de `validation.ts`.
 *
 * O tradutor entra como parâmetro porque a validação é React-free de propósito: a regra que
 * mais importa (quando o texto global é exigido) precisa ser testável sem DOM, e o `apps/web`
 * não tem jsdom.
 *
 * Cada componente que precisa de validação chama este hook em vez de receber por prop: assim
 * quem re-renderiza a cada tecla é só a folha que de fato lê o resultado.
 */
export function useComposerValidation(): ComposerValidacao {
  const t = useTranslations('composer');
  const channels = useChannels();
  const providers = useProviders();
  const mediaLibrary = useMediaList();

  const text = useComposerText();
  const overrides = useComposerOverrides();
  const thread = useComposerThread();
  const mediaIds = useComposerMediaIds();
  const channelSettings = useComposerChannelSettings();
  const publishAtLocal = useComposerPublishAtLocal();
  const selected = useCanaisSelecionados();
  const suporteAThread = useSuporteAThread();

  const traduz: Traduz = Object.assign(
    (key: string, values?: Record<string, string | number>) => t(key, values),
    { has: (key: string) => t.has(key) },
  );

  const providerOf = (providerId: string) => providers.data?.find((p) => p.id === providerId);

  const porId = new Map((mediaLibrary.data ?? []).map((m) => [m.id, m]));
  const selectedMedia = mediaIds.map((id) => porId.get(id)).filter((m) => m !== undefined);

  const input = {
    text,
    overrides,
    channelSettings,
    thread: thread.map((item) => ({ key: item.key, text: item.text, delaySec: item.delaySec })),
    selected,
    selectedMedia,
    providerOf,
  };

  const publishAt = publishAtLocal ? new Date(publishAtLocal) : null;

  return {
    selected,
    totalCanais: (channels.data ?? []).length,
    counters: computeCounters(input),
    minMax: computeMinMax(selected, providerOf),
    issues: computeIssues(input, traduz),
    scheduleIssues: computeScheduleIssues(publishAt, traduz),
    publishAt,
    ...suporteAThread,
    providerOf,
  };
}
