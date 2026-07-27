import type { Metadata } from 'next';
import { ConnectionsView } from '@/features/channels/connections-view';

export const metadata: Metadata = { title: 'Conexões' };

export default function ConexoesPage() {
  return <ConnectionsView />;
}
