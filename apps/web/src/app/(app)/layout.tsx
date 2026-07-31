import { AppSidebar } from '@/components/shell/app-sidebar';
import { Topbar } from '@/components/shell/topbar';
import { PageShell } from '@/components/ui/page-shell';
import { ComposerModal } from '@/features/composer/composer-modal';
import { RealtimeListener } from '@/features/realtime/realtime-listener';
import { CommandPalette } from '@/features/search/command-palette';

/** Shell autenticado: sidebar fixa + topbar; conteúdo client-heavy (SPEC §1). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <RealtimeListener />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-3 md:p-6">
          <PageShell>{children}</PageShell>
        </main>
      </div>
      {/* composer vive num popup global — "Novo post"/"+"/duplicar o abrem sobre a página */}
      <ComposerModal />
      {/* paleta global: ⌘K de qualquer tela, e o gatilho visível fica na topbar */}
      <CommandPalette />
    </div>
  );
}
