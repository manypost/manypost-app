'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useComposerModal } from '@/features/composer/use-composer-modal';

/**
 * /compor virou um atalho: a criação de post agora é um modal grande (ComposerModal)
 * aberto sobre a página atual. Deep-links para /compor abrem o modal e voltam ao calendário.
 */
export default function ComporPage() {
  const router = useRouter();
  useEffect(() => {
    useComposerModal.getState().openComposer();
    router.replace('/calendario');
  }, [router]);
  return null;
}
