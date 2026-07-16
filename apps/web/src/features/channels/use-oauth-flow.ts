'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useInvalidateChannels } from './hooks';
import { openOauthPopup } from './oauth-popup';

/** Conduz o popup OAuth e refaz a lista de canais quando o fluxo termina. */
export function useOauthFlow() {
  const t = useTranslations('connections');
  const invalidate = useInvalidateChannels();
  return async (url: string) => {
    const result = await openOauthPopup(url);
    await invalidate();
    if (result === 'done') toast.success(t('connected'));
  };
}
