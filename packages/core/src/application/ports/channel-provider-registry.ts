import type { ChannelProvider } from '@manypost/contracts';

/** Registry de providers (SPEC_INTEGRATIONS §2) — implementado por packages/providers. */
export interface ChannelProviderRegistry {
  get(id: string): ChannelProvider | undefined;
  list(): ChannelProvider[];
}
