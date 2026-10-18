import type { Metadata, Viewport } from 'next';
import { Kiwi_Maru, Klee_One, Yusei_Magic } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import './globals.css';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const yusei = Yusei_Magic({ weight: '400', subsets: ['latin'], variable: '--font-yusei-magic', preload: false, display: 'swap' });
const kiwi = Kiwi_Maru({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-kiwi-maru', preload: false, display: 'swap' });
const klee = Klee_One({ weight: '600', subsets: ['latin'], variable: '--font-klee-one', preload: false, display: 'swap' });

export const metadata: Metadata = {
  title: 'カンジクエスト',
  description: '漢検9級（小1・小2の240字）を冒険しながら覚える学習アプリ',
  applicationName: 'カンジクエスト',
  appleWebApp: { capable: true, title: 'カンジクエスト', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: `${BASE}/icons/favicon-32.png`, sizes: '32x32', type: 'image/png' }],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png`, sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#5a3e2b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${yusei.variable} ${kiwi.variable} ${klee.variable}`}>
      <body>
        <div className="app-outer">
          <div className="app-frame">
            <AppShell>{children}</AppShell>
          </div>
        </div>
      </body>
    </html>
  );
}
