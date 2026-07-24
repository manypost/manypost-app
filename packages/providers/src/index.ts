import type { ChannelProvider } from '@manypost/contracts';
import { blueskyProvider } from './bluesky/bluesky.provider';
import { devtoProvider } from './devto/devto.provider';
import { discordProvider } from './discord/discord.provider';
import { discordWebhookProvider } from './discord/discord-webhook.provider';
import { facebookProvider } from './facebook/facebook.provider';
import { fakeProvider } from './fake/fake.provider';
import { instagramProvider } from './instagram/instagram.provider';
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
 * instagram-standalone (Instagram Login sem Página do Facebook — mesmo molde container→publish),
 * facebook (Página; Página escolhida por post via sub-contas, token da Página derivado no publish) e
 * instagram (via Facebook Business — junta os dois moldes: OAuth/sub-contas do facebook + o fluxo
 * container→poll→publish; a conta IG é resolvida pela Página escolhida no post).
 * Onda 3: devto — primeiro destino de ARTIGO (markdown, título obrigatório em settings, capa vinda
 * da mídia anexada) e a primeira rede sem nenhum gate externo: conecta por chave pessoal, sem env.
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
  instagramProvider,
  twitchProvider,
  kickProvider,
  devtoProvider,
  fakeProvider,
];

export const providerRegistry = {
  get: (id: string) => providers.find((p) => p.id === id),
  list: () => providers,
};

export {
  blueskyProvider,
  devtoProvider,
  discordProvider,
  discordWebhookProvider,
  facebookProvider,
  fakeProvider,
  instagramProvider,
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
