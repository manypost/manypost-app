'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSocialProviders } from './hooks';
import { SOCIAL_ICONS } from './social-icons';

/**
 * Login social do catálogo GET /v1/auth/social (vazio = some). Fica no topo do
 * formulário, com a logo de cada provedor e lado a lado quando há mais de um; o
 * divisor abaixo faz a ponte para o login por e-mail.
 */
export function SocialButtons() {
  const t = useTranslations('auth');
  const { data } = useSocialProviders();
  const providers = data?.providers ?? [];
  if (!providers.length) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('grid gap-2', providers.length > 1 && 'grid-cols-2')}>
        {providers.map((p) => {
          const Icon = SOCIAL_ICONS[p.id];
          return (
            <Button key={p.id} variant="outline" asChild>
              {/* navegação plena: a API redireciona ao provedor e volta com cookies */}
              <a href={`/v1/auth/social/${p.id}`}>
                {Icon ? <Icon /> : null}
                {p.name}
              </a>
            </Button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-graphite">{t('socialDividerEmail')}</span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}
