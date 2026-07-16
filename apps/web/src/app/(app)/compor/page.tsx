import type { Metadata } from 'next';
import { ComposerView } from '@/features/composer/composer-view';

export const metadata: Metadata = { title: 'Novo post' };

export default function ComporPage() {
  return <ComposerView />;
}
