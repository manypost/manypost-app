import type { Metadata } from 'next';
import { MediaView } from '@/features/media/media-view';

export const metadata: Metadata = { title: 'Mídia' };

export default function MidiaPage() {
  return <MediaView />;
}
