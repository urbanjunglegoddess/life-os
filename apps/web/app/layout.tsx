import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { TOKEN_CSS } from './theme';

export const metadata: Metadata = {
  title: 'Life OS',
  description: 'Account deletion, privacy policy and terms of service for Life OS.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: TOKEN_CSS }} />
      </head>
      <body>
        <main>
          <nav>
            <a href="/delete-account">Delete account</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
