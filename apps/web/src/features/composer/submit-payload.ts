import type { components } from '@/lib/api/schema';

type Channel = components['schemas']['Channel'];

/** corpo do POST /v1/posts montado pelo composer (campos vazios são omitidos em `hooks.ts`) */
export interface SchedulePayload {
  text: string;
  channelIds: string[];
  /** ISO UTC */
  publishAt: string;
  timezone: string;
  textByChannel?: Record<string, string>;
  settingsByChannel?: Record<string, Record<string, unknown>>;
  mediaIds?: string[];
  thread?: Array<{ text: string; mediaIds?: string[]; delaySec?: number }>;
  requireApproval?: boolean;
}

export interface SchedulePayloadInput {
  text: string;
  overrides: Record<string, string>;
  channelSettings: Record<string, Record<string, unknown>>;
  mediaIds: string[];
  thread: Array<{ text: string; mediaIds: string[]; delaySec: number }>;
  /** canais efetivamente selecionados, na ordem de exibição */
  selected: Channel[];
  publishAt: Date;
  timezone: string;
  requireApproval: boolean;
}

/**
 * Monta o corpo do agendamento.
 *
 * Duas decisões moram aqui, e as duas vêm de a caixa global poder ficar vazia quando todo canal
 * tem texto próprio:
 *
 *  1. **Todo override não-vazio vai explícito** em `textByChannel`. A versão anterior descartava
 *     o override igual ao texto global — com o global vazio isso descartaria tudo.
 *  2. **`text` cai para o texto do primeiro canal** quando o global está vazio. `text` é o
 *     `baseContent` do grupo (o que calendário, página de aprovação e duplicar leem) e a API o
 *     exige não-vazio; esta fatia não mexe no contrato. Como cada canal já viaja com o seu
 *     próprio texto, nenhum deles depende de qual foi escolhido como base.
 */
export function buildSchedulePayload(input: SchedulePayloadInput): SchedulePayload {
  const textByChannel: Record<string, string> = {};
  for (const ch of input.selected) {
    const proprio = input.overrides[ch.id]?.trim();
    if (proprio) textByChannel[ch.id] = proprio;
  }

  const global = input.text.trim();
  const base = global || (input.selected.map((ch) => textByChannel[ch.id]).find(Boolean) ?? '');

  const settingsByChannel: Record<string, Record<string, unknown>> = {};
  for (const ch of input.selected) {
    const settings = input.channelSettings[ch.id];
    if (settings && Object.keys(settings).length > 0) settingsByChannel[ch.id] = settings;
  }

  return {
    text: base,
    channelIds: input.selected.map((ch) => ch.id),
    publishAt: input.publishAt.toISOString(),
    timezone: input.timezone,
    textByChannel,
    settingsByChannel,
    mediaIds: input.mediaIds,
    thread: input.thread.map((item) => ({
      text: item.text.trim(),
      ...(item.mediaIds.length > 0 ? { mediaIds: item.mediaIds } : {}),
      ...(item.delaySec > 0 ? { delaySec: item.delaySec } : {}),
    })),
    requireApproval: input.requireApproval,
  };
}
