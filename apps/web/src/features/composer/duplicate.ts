import type { components } from '@/lib/api/schema';
import type { ComposerPrefill } from './store';

type GroupDetail = components['schemas']['PostGroupDetail'];
type Channel = components['schemas']['Channel'];
type ProviderInfo = components['schemas']['ChannelProviderInfo'];
type MediaRef = components['schemas']['MediaRef'];

/** Subconjunto do settingsSchema necessário p/ comparar valores com defaults. */
interface SchemaWithDefaults {
  properties?: Record<string, { default?: unknown }>;
}

/** Mantém só o que difere do default do settingsSchema — a API devolve os settings
 *  já com defaults, e re-enviá-los marcaria o acordeão como "alterado" sem o
 *  usuário ter mexido. Chave fora do schema não é editável no composer e cai fora. */
const nonDefaultSettings = (
  settings: Record<string, unknown>,
  schema: SchemaWithDefaults | undefined,
): Record<string, unknown> => {
  const props = schema?.properties ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    const field = props[key];
    if (!field) continue;
    if (JSON.stringify(value) === JSON.stringify(field.default)) continue;
    out[key] = value;
  }
  return out;
};

/**
 * Monta o rascunho do composer a partir do detalhe de um grupo (duplicar post):
 * texto base + overrides por canal, settings não-default, mídia e thread.
 * Canais desconectados e mídia removida da biblioteca ficam de fora
 * (droppedChannels conta os canais perdidos p/ avisar o usuário).
 */
export function buildDuplicatePrefill(input: {
  group: GroupDetail;
  channels: Channel[];
  providers: ProviderInfo[];
  /** null = biblioteca ainda não carregada — não filtra (o servidor revalida no agendar) */
  libraryMediaIds: Set<string> | null;
}): { prefill: ComposerPrefill; droppedChannels: number } {
  const { group, channels, providers, libraryMediaIds } = input;
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const schemaByProvider = new Map(
    providers.map((p) => [p.id, p.settingsSchema as SchemaWithDefaults | undefined]),
  );

  const pickMediaIds = (media: MediaRef[]) =>
    media
      .map((m) => m.mediaId)
      .filter((id): id is string => id !== undefined && (libraryMediaIds?.has(id) ?? true));

  const channelIds: string[] = [];
  const overrides: Record<string, string> = {};
  const channelSettings: Record<string, Record<string, unknown>> = {};
  let droppedChannels = 0;

  for (const pub of group.publications) {
    const channel = channelById.get(pub.channelId);
    if (!channel || channel.status !== 'ACTIVE') {
      droppedChannels++;
      continue;
    }
    channelIds.push(pub.channelId);
    if (pub.text !== group.text) overrides[pub.channelId] = pub.text;
    const settings = nonDefaultSettings(
      pub.settings as Record<string, unknown>,
      schemaByProvider.get(channel.provider),
    );
    if (Object.keys(settings).length > 0) channelSettings[pub.channelId] = settings;
  }

  // mídia e thread são globais (iguais em todas as publicações) — a 1ª serve de fonte
  const first = group.publications[0];
  return {
    prefill: {
      text: group.text,
      channelIds,
      overrides,
      channelSettings,
      mediaIds: pickMediaIds(first?.media ?? []),
      thread: (first?.thread ?? []).map((item) => ({
        text: item.text,
        delaySec: item.delaySec,
        mediaIds: pickMediaIds(item.media),
      })),
      requireApproval: group.state === 'DRAFT',
    },
    droppedChannels,
  };
}
