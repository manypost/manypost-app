'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useComposerModal } from '@/features/composer/use-composer-modal';

/**
 * `/compor` deixou de ser uma tela: o composer agora é um popup global. Esta
 * rota vira só um atalho — abre o popup e volta ao calendário (deep-link e
 * bookmarks antigos continuam funcionando).
 */
export default function ComporPage() {
  const router = useRouter();
  const openComposer = useComposerModal((s) => s.openComposer);
  useEffect(() => {
    openComposer();
    router.replace('/calendario');
  }, [openComposer, router]);
  return null;
}
