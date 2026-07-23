import type { ChannelProvider } from '@manypost/contracts';
import { blueskyProvider } from './bluesky/bluesky.provider';
import { discordProvider } from './discord/discord.provider';
import { discordWebhookProvider } from './discord/discord-webhook.provider';
import { facebookProvider } from './facebook/facebook.provider';
import { fakeProvider } from './fake/fake.provider';
import { instagramStandaloneProvider } from './instagram-standalone/instagram-standalone.provider';
import { kickProvider } from './kick/kick.provider';
import { linkedinProvider } from './linkedin/linkedin.provider';
import { mastodonProvider } from './mastodon/mastodon.provider';
import { telegramProvider } from './telegram/telegram.provider';
import { threadsProvider } from './threads/threads.provider';
import { tiktokProvider } from './tiktok/tiktok.provider';
import { twitchProvider } from './twitch/twitch.provider';
import { xProvider } from './x/x.provider';

/**
 * Registry de providers (SPEC_INTEGRATIONS §2). Onda 1 (SPEC_ROADMAP) completa:
 * mastodon, telegram, bluesky, discord (oauth), discord-webhook, linkedin, x — cada um em sua pasta, registrado
 * aqui, com a suíte de contrato (test-kit) verde antes do merge. Onda 2: tiktok (Content Posting API),
 * threads (primeiro da família Meta — container → threads_publish), a dupla de streaming
 * twitch/kick, que publica no **chat ao vivo** em vez de um feed,
 * instagram-standalone (Instagram Login sem Página do Facebook — mesmo molde container→publish) e
 * facebook (Página; Página escolhida por post via sub-contas, token da Página derivado no publish).
 */
export const providers: ChannelProvider[] = [
  mastodonProvider,
  telegramProvider,
  blueskyProvider,
  discordProvider,
  discordWebhookProvider,
  linkedinProvider,
  xProvider,
  tiktokProvider,
  threadsProvider,
  instagramStandaloneProvider,
  facebookProvider,
  twitchProvider,
  kickProvider,
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
  facebookProvider,
  fakeProvider,
  instagramStandaloneProvider,
  kickProvider,
  linkedinProvider,
  mastodonProvider,
  telegramProvider,
  threadsProvider,
  tiktokProvider,
  twitchProvider,
  xProvider,
};

export { settingsJsonSchema } from './shared/settings-json-schema';
