import type { components } from '@/lib/api/schema';
import { validateMediaForProvider } from './media-validation';

/**
 * Validação client-side do composer (SPEC_FRONTEND §3.3). O servidor revalida tudo no
 * agendamento — isto existe para dar resposta imediata e para explicar por que o CTA está
 * travado.
 *
 * Sem React de propósito: `apps/web` não tem jsdom nem testing-library, então a regra que mais
 * importa (quando o texto global é exigido) precisa ser testável como função.
 */

type Channel = components['schemas']['Channel'];
type ProviderInfo = components['schemas']['ChannelProviderInfo'];
type Media = components['schemas']['Media'];

/** tradutor no formato mínimo que a validação usa — o hook adapta o `useTranslations` a isto */
export interface Traduz {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
}

/** o que levantou a issue: permite mostrar só o que é do escopo e levar até a causa */
export type IssueOrigin =
  | { kind: 'post' }
  | { kind: 'channel'; channelId: string }
  | { kind: 'thread'; threadKey: string };

export interface ComposerIssue {
  /** mensagem já traduzida — a validação recebe o tradutor, não monta texto */
  message: string;
  origin: IssueOrigin;
}

/** qual editor está perguntando; cada popover mostra só o que lhe diz respeito */
export type IssueScope =
  | { kind: 'global' }
  | { kind: 'channel'; channelId: string }
  | { kind: 'thread'; threadKey: string };

export interface ChannelCounter {
  channel: Channel;
  provider: ProviderInfo | undefined;
  /** limite base da rede; undefined = rede sem limite declarado */
  max: number | undefined;
  len: number;
  over: boolean;
  /** true = tem texto próprio; false = herda o global */
  customizado: boolean;
}

export interface ThreadItemInput {
  key: string;
  text: string;
  delaySec: number;
}

export interface ValidationInput {
  text: string;
  overrides: Record<string, string>;
  channelSettings: Record<string, Record<string, unknown>>;
  thread: ThreadItemInput[];
  /** canais do rascunho que ainda existem, na ordem de exibição */
  selected: Channel[];
  selectedMedia: Media[];
  providerOf: (providerId: string) => ProviderInfo | undefined;
}

const THREAD_DELAY_MAX_SEC = 600;

/** texto que este canal vai publicar: o próprio, quando personalizado; senão o global */
export const textoDoCanal = (
  channelId: string,
  text: string,
  overrides: Record<string, string>,
): string => overrides[channelId] ?? text;

/**
 * Canais que ainda dependem do texto global. Um canal com override **vazio** não está aqui: ele
 * é personalizado e vazio, o que é um problema dele (`emptyOverride`), não do texto global.
 */
export const canaisHerdandoGlobal = (
  selected: Channel[],
  overrides: Record<string, string>,
): Channel[] => selected.filter((ch) => overrides[ch.id] === undefined);

export function computeCounters(input: ValidationInput): ChannelCounter[] {
  return input.selected.map((channel) => {
    const provider = input.providerOf(channel.provider);
    const max = provider?.maxLength;
    const len = textoDoCanal(channel.id, input.text, input.overrides).trim().length;
    return {
      channel,
      provider,
      max,
      len,
      over: max !== undefined && len > max,
      customizado: input.overrides[channel.id] !== undefined,
    };
  });
}

/** limite mais apertado entre os canais selecionados — é o que vale para itens de thread */
export function computeMinMax(
  selected: Channel[],
  providerOf: ValidationInput['providerOf'],
): number | undefined {
  return selected.reduce<number | undefined>((acc, ch) => {
    const max = providerOf(ch.provider)?.maxLength;
    if (max === undefined) return acc;
    return acc === undefined ? max : Math.min(acc, max);
  }, undefined);
}

export type NivelCapacidade = 'vazio' | 'ok' | 'perto' | 'acima';

/** estado do medidor de capacidade do trilho de canais */
export function nivelCapacidade(len: number, max: number | undefined): NivelCapacidade {
  if (len === 0) return 'vazio';
  if (max === undefined || max === 0) return 'ok';
  if (len > max) return 'acima';
  return len / max >= 0.9 ? 'perto' : 'ok';
}

/** fração ocupada do limite, limitada a 1 para desenhar a barra */
export function fracaoCapacidade(len: number, max: number | undefined): number {
  if (max === undefined || max === 0) return len > 0 ? 1 : 0;
  return Math.min(len / max, 1);
}

/**
 * Issues que travam o agendamento.
 *
 * A regra que mudou: **o texto global só é exigido quando algum canal selecionado ainda herda
 * dele**. Quem escreve um texto próprio para cada canal e deixa a caixa global vazia tem um
 * rascunho completo — a versão anterior exigia o global sempre e travava os dois CTAs sem saída.
 */
export function computeIssues(input: ValidationInput, t: Traduz): ComposerIssue[] {
  const issues: ComposerIssue[] = [];
  const doPost = (message: string) => issues.push({ message, origin: { kind: 'post' } });
  const doCanal = (channelId: string, message: string) =>
    issues.push({ message, origin: { kind: 'channel', channelId } });

  const counters = computeCounters(input);
  const nomeDe = (ch: Channel) => ch.name ?? ch.username ?? ch.id;

  const herdando = canaisHerdandoGlobal(input.selected, input.overrides);
  const globalVazio = input.text.trim().length === 0;
  // sem canal escolhido ainda não há texto próprio possível: o global é o único conteúdo
  if (globalVazio && (input.selected.length === 0 || herdando.length > 0)) {
    doPost(t('issues.emptyText'));
  }
  if (input.selected.length === 0) doPost(t('issues.noChannelSelected'));

  for (const { channel } of counters) {
    const override = input.overrides[channel.id];
    if (override !== undefined && override.trim().length === 0) {
      doCanal(channel.id, t('issues.emptyOverride', { name: nomeDe(channel) }));
    }
  }

  // uma issue por canal (e não uma lista concatenada): assim cada uma leva ao canal que a levantou
  for (const c of counters) {
    if (c.over) doCanal(c.channel.id, t('issues.overLimit', { channels: nomeDe(c.channel) }));
  }

  if (input.selectedMedia.length > 0) {
    for (const ch of input.selected) {
      const info = input.providerOf(ch.provider);
      if (!info) continue;
      const vistas = new Set<string>();
      for (const issue of validateMediaForProvider(info, input.selectedMedia)) {
        const msg = t(`issues.media.${issue.code}`, {
          name: nomeDe(ch),
          max: 'max' in issue ? issue.max : 0,
          mime: 'mime' in issue ? issue.mime : '',
        });
        if (vistas.has(msg)) continue;
        vistas.add(msg);
        doCanal(ch.id, msg);
      }
    }
  } else {
    // redes que não aceitam post só-texto (ex.: TikTok) — o servidor revalida no agendamento
    for (const ch of input.selected) {
      if (input.providerOf(ch.provider)?.requiresMedia) {
        doCanal(ch.id, t('issues.requiresMedia', { name: nomeDe(ch) }));
      }
    }
  }

  // settings obrigatórias por canal (ex.: canal do Discord) — o servidor revalida
  for (const ch of input.selected) {
    const info = input.providerOf(ch.provider);
    const required = (info?.settingsSchema as { required?: string[] } | undefined)?.required ?? [];
    const chSettings = input.channelSettings[ch.id] ?? {};
    for (const key of required) {
      const v = chSettings[key];
      const ausente =
        v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      if (!ausente) continue;
      const field =
        info && t.has(`channelSettings.fields.${info.id}.${key}`)
          ? t(`channelSettings.fields.${info.id}.${key}`)
          : key;
      doCanal(ch.id, t('issues.missingSetting', { name: nomeDe(ch), field }));
    }
  }

  const semSuporteAThread = input.selected
    .filter((ch) => !input.providerOf(ch.provider)?.threads)
    .map(nomeDe);
  if (input.thread.length > 0 && semSuporteAThread.length > 0) {
    doPost(t('issues.threadUnsupported', { channels: semSuporteAThread.join(', ') }));
  }

  const minMax = computeMinMax(input.selected, input.providerOf);
  input.thread.forEach((item, i) => {
    const doItem = (message: string) =>
      issues.push({ message, origin: { kind: 'thread', threadKey: item.key } });
    const len = item.text.trim().length;
    if (len === 0) doItem(t('issues.threadEmpty', { index: i + 1 }));
    if (minMax !== undefined && len > minMax) doItem(t('issues.threadOverLimit', { index: i + 1 }));
    if (item.delaySec < 0 || item.delaySec > THREAD_DELAY_MAX_SEC) {
      doItem(t('issues.threadDelay', { index: i + 1 }));
    }
  });

  return issues;
}

/** issues que travam só o agendamento (publicar agora segue liberado) */
export function computeScheduleIssues(publishAt: Date | null, t: Traduz): ComposerIssue[] {
  if (!publishAt || Number.isNaN(publishAt.getTime())) {
    return [{ message: t('issues.noDate'), origin: { kind: 'post' } }];
  }
  if (publishAt.getTime() < Date.now() - 60_000) {
    return [{ message: t('issues.pastDate'), origin: { kind: 'post' } }];
  }
  return [];
}

/** o que este editor deve mostrar: o que é do post inteiro mais o que é dele */
export function issuesDoEscopo(issues: ComposerIssue[], escopo: IssueScope): ComposerIssue[] {
  const cabe = ({ origin }: ComposerIssue) => {
    if (origin.kind === 'post') return true;
    // a caixa global alimenta todo canal que herda dela, então responde por todos
    if (escopo.kind === 'global') return origin.kind === 'channel';
    if (escopo.kind === 'channel') {
      return origin.kind === 'channel' && origin.channelId === escopo.channelId;
    }
    return origin.kind === 'thread' && origin.threadKey === escopo.threadKey;
  };
  const vistas = new Set<string>();
  return issues.filter((issue) => {
    if (!cabe(issue) || vistas.has(issue.message)) return false;
    vistas.add(issue.message);
    return true;
  });
}
