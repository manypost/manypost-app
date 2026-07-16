'use client';

import { useTranslations } from 'next-intl';
import { errorCode } from './client';

/**
 * Traduz o problem+json da API p/ mensagem legível: usa a tradução do código
 * estável quando existe, senão cai no `detail` da API (já vem legível em
 * pt-BR), senão erro genérico.
 */
export function useApiErrorMessage() {
  const t = useTranslations();
  return (problem: unknown): string => {
    const code = errorCode(problem);
    if (t.has(`errors.${code}`)) return t(`errors.${code}`);
    const detail = (problem as { detail?: string } | undefined)?.detail;
    return detail ?? t('common.genericError');
  };
}
