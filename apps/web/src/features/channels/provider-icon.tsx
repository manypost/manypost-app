import { cn } from '@/lib/utils';

/**
 * Tiles SVG das redes (public/social — fundo e raio próprios, cores de marca
 * de terceiros; a regra "cores só via token" vale p/ a UI, não p/ logomarcas).
 * Chave = id do provider no registry. Sem tile → fallback com a inicial
 * (hoje: mastodon, bluesky e fake ainda sem SVG).
 */
export const PROVIDER_ICONS: Record<string, string> = {
  devto: '/social/Devto.svg',
  discord: '/social/Discord.svg',
  'discord-webhook': '/social/Discord.svg',
  dribbble: '/social/Dribbble.svg',
  facebook: '/social/Facebook.svg',
  gmb: '/social/Gmb.svg',
  instagram: '/social/Instagram.svg',
  linkedin: '/social/Linkedin.svg',
  medium: '/social/Medium.svg',
  pinterest: '/social/Pinterest.svg',
  reddit: '/social/Reddit.svg',
  slack: '/social/Slack.svg',
  telegram: '/social/Telegram.svg',
  threads: '/social/Threads.svg',
  tiktok: '/social/TikTok.svg',
  x: '/social/X.svg',
  youtube: '/social/Youtube.svg',
  mastodon: '/social/Mastodon.svg',
  bluesky: '/social/Bluesky.svg',
};

export function ProviderIcon({
  provider,
  name,
  className,
}: {
  provider: string;
  name: string;
  className?: string;
}) {
  const src = PROVIDER_ICONS[provider];
  if (!src) {
    return (
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-sm font-bold text-ink',
          className,
        )}
      >
        {name.charAt(0)}
      </span>
    );
  }
  // decorativo: o nome da rede está sempre adjacente no texto
  return <img src={src} alt="" aria-hidden className={cn('shrink-0 rounded-md', className)} />;
}
