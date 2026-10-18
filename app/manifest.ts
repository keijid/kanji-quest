import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'カンジクエスト',
    short_name: 'カンジクエスト',
    description: '小学2年生の漢字160字を冒険しながら覚える学習アプリ（漢検9級）',
    lang: 'ja',
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: 'standalone',
    // 横向きが基本だが、縦向きでも使えるので固定しない
    orientation: 'any',
    background_color: '#5a3e2b',
    theme_color: '#5a3e2b',
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
