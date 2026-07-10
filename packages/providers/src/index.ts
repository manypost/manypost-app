import type { ChannelProvider } from '@manypost/contracts';
import { fakeProvider } from './fake/fake.provider';

/**
 * Registry de providers (SPEC_INTEGRATIONS §2).
 * Onda 1 (SPEC_ROADMAP): mastodon, linkedin, x, discord, telegram, bluesky — cada um em sua pasta,
 * registrado aqui, com a suíte de contrato (test-kit) verde antes do merge.
 */
export const providers: ChannelProvider[] = [fakeProvider];

export const providerRegistry = {
  get: (id: string) => providers.find((p) => p.id === id),
  list: () => providers,
};

export { fakeProvider };
