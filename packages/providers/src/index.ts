import type { ChannelProvider } from '@manypost/contracts';
import { blueskyProvider } from './bluesky/bluesky.provider';
import { discordProvider } from './discord/discord.provider';
import { fakeProvider } from './fake/fake.provider';
import { linkedinProvider } from './linkedin/linkedin.provider';
import { mastodonProvider } from './mastodon/mastodon.provider';
import { telegramProvider } from './telegram/telegram.provider';
import { xProvider } from './x/x.provider';

/**
 * Registry de providers (SPEC_INTEGRATIONS §2). Onda 1 (SPEC_ROADMAP) completa:
 * mastodon, telegram, bluesky, discord, linkedin, x — cada um em sua pasta, registrado
 * aqui, com a suíte de contrato (test-kit) verde antes do merge.
 */
export const providers: ChannelProvider[] = [
  mastodonProvider,
  telegramProvider,
  blueskyProvider,
  discordProvider,
  linkedinProvider,
  xProvider,
  fakeProvider,
];

export const providerRegistry = {
  get: (id: string) => providers.find((p) => p.id === id),
  list: () => providers,
};

export {
  blueskyProvider,
  discordProvider,
  fakeProvider,
  linkedinProvider,
  mastodonProvider,
  telegramProvider,
  xProvider,
};
