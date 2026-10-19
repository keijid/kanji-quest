import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
import { existsSync, readdirSync } from 'node:fs';

// サブパス配下に置くときだけ、ビルド時に NEXT_PUBLIC_BASE_PATH を渡す。Firebase Hosting・ローカルでは空。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// 静的に書き出す全画面。Service Worker が先に保存して、オフラインでも開けるようにする
const ROUTES = ['', 'onboard', 'home', 'lesson', 'play', 'result', 'practice', 'zukan', 'mock', 'parent', 'credits', ...Array.from({ length: 16 }, (_, i) => `stage/${i + 1}`)];
const revision = process.env.GITHUB_SHA ?? String(Date.now());
// public/ の画像（相棒の絵・アイコン・マップの背景・ボス・モードのアイコン・勇者の絵）も先に保存する
const PUBLIC_FILES = ['partners', 'icons', 'maps', 'bosses', 'modes', 'heroes']
  .filter((dir) => existsSync(`public/${dir}`))
  .flatMap((dir) => readdirSync(`public/${dir}`).filter((f) => /\.(png|jpg|webp)$/.test(f)).map((f) => `${dir}/${f}`));

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  swUrl: '/sw.js', // basePath は Serwist が前に付ける
  scope: `${basePath}/`,
  disable: process.env.NODE_ENV === 'development',
  additionalPrecacheEntries: [
    ...ROUTES.map((r) => ({ url: `${basePath}/${r ? `${r}/` : ''}`, revision })),
    // 画面を切りかえるときに読む RSC のデータ（?_rsc=… はキャッシュの照合で無視する）
    ...ROUTES.map((r) => ({ url: `${basePath}/${r ? `${r}/` : ''}index.txt`, revision })),
    { url: `${basePath}/manifest.webmanifest`, revision },
    { url: `${basePath}/sfx/sounds.json`, revision },
    ...PUBLIC_FILES.map((f) => ({ url: `${basePath}/${f}`, revision })),
    { url: `${basePath}/title.png`, revision },
  ],
});

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default withSerwist(nextConfig);
