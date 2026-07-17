import type { ChannelProvider } from '@manypost/contracts';
import { blueskyProvider } from './bluesky/bluesky.provider';
import { discordProvider } from './discord/discord.provider';
import { discordWebhookProvider } from './discord/discord-webhook.provider';
import { fakeProvider } from './fake/fake.provider';
import { linkedinProvider } from './linkedin/linkedin.provider';
import { mastodonProvider } from './mastodon/mastodon.provider';
import { telegramProvider } from './telegram/telegram.provider';
import { xProvider } from './x/x.provider';

/**
 * Registry de providers (SPEC_INTEGRATIONS §2). Onda 1 (SPEC_ROADMAP) completa:
 * mastodon, telegram, bluesky, discord (oauth), discord-webhook, linkedin, x — cada um em sua pasta, registrado
 * aqui, com a suíte de contrato (test-kit) verde antes do merge.
 */
export const providers: ChannelProvider[] = [
  mastodonProvider,
  telegramProvider,
  blueskyProvider,
  discordProvider,
  discordWebhookProvider,
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
  discordWebhookProvider,
  fakeProvider,
  linkedinProvider,
  mastodonProvider,
  telegramProvider,
  xProvider,
};

export { settingsJsonSchema } from './shared/settings-json-schema';
