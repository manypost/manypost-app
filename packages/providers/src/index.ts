import type { ChannelProvider } from '@manypost/contracts';
import { blueskyProvider } from './bluesky/bluesky.provider';
import { fakeProvider } from './fake/fake.provider';
import { mastodonProvider } from './mastodon/mastodon.provider';
import { telegramProvider } from './telegram/telegram.provider';

/**
 * Registry de providers (SPEC_INTEGRATIONS §2).
 * Onda 1 (SPEC_ROADMAP): mastodon ✓, telegram ✓, bluesky ✓; faltam linkedin, x, discord —
 * cada um em sua pasta, registrado aqui, com a suíte de contrato (test-kit) verde antes do merge.
 */
export const providers: ChannelProvider[] = [
  mastodonProvider,
  telegramProvider,
  blueskyProvider,
  fakeProvider,
];

export const providerRegistry = {
  get: (id: string) => providers.find((p) => p.id === id),
  list: () => providers,
};

export { blueskyProvider, fakeProvider, mastodonProvider, telegramProvider };
