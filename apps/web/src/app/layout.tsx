import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import { ClerkSessionBridge } from '@/features/auth/clerk-session-bridge';
import './globals.css';

// self-host via next/font (docs/brand/README.md §2 — nada de CDN de fontes)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

// wordmark sempre minúsculo, inclusive em <title> (regra inviolável da raiz do repo)
export const metadata: Metadata = {
  title: { default: 'manypost', template: '%s · manypost' },
  description: 'agendamento e publicação multicanal',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content = (
    <NextIntlClientProvider>
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  );
  return (
    <html lang={locale} className={`${inter.variable} ${jakarta.variable}`}>
      <body>
        {publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            taskUrls={{
              'choose-organization': '/session-tasks/choose-organization',
              'reset-password': '/session-tasks/reset-password',
              'setup-mfa': '/session-tasks/setup-mfa',
            }}
          >
            <ClerkSessionBridge />
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
