'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSocialProviders } from './hooks';

/** Botões de login social do catálogo GET /v1/auth/social (vazio = some). */
export function SocialButtons() {
  const t = useTranslations('auth');
  const { data } = useSocialProviders();
  if (!data?.providers?.length) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-graphite">{t('socialDivider')}</span>
        <Separator className="flex-1" />
      </div>
      <div className="grid gap-2">
        {data.providers.map((p) => (
          <Button key={p.id} variant="outline" asChild>
            {/* navegação plena: a API redireciona ao provedor e volta com cookies */}
            <a href={`/v1/auth/social/${p.id}`}>{p.name}</a>
          </Button>
        ))}
      </div>
    </div>
  );
}
