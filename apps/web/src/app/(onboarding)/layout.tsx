import { Wordmark } from '@/components/brand/wordmark';

/**
 * Shell do onboarding: sem sidebar e sem topbar do app — a tela de conversão pós-cadastro
 * fica sozinha na página (paridade com o onboarding do Postiz, ver docs/references).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-line bg-surface px-4 md:px-8">
        <Wordmark className="text-base font-bold text-ink" />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
