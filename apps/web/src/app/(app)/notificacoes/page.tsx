import type { Metadata } from 'next';
import { NotificationsView } from '@/features/notifications/notifications-view';

export const metadata: Metadata = { title: 'Notificações' };

export default function NotificacoesPage() {
  return <NotificationsView />;
}
