import { AppSidebar } from '@/components/shell/app-sidebar';
import { Topbar } from '@/components/shell/topbar';
import { ComposerModal } from '@/features/composer/composer-modal';
import { RealtimeListener } from '@/features/realtime/realtime-listener';

/** Shell autenticado: sidebar fixa + topbar; conteúdo client-heavy (SPEC §1). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <RealtimeListener />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-3 md:p-6">{children}</main>
      </div>
      {/* modal de criação de post — aberto sobre a página via useComposerModal */}
      <ComposerModal />
    </div>
  );
}
