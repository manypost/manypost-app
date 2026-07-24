import { Wordmark } from '@/components/brand/wordmark';

/** Shell mínimo para consentimento OAuth MCP — sem sidebar do app. */
export default function OAuthConsentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-line bg-surface px-4 md:px-8">
        <Wordmark className="text-base font-bold text-ink" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 md:py-16">{children}</main>
    </div>
  );
}
