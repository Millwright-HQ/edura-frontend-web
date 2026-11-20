import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { getTheme } from '@/lib/ui';
import './globals.css';

const font = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = { title: 'Edura' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme={await getTheme()} className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
