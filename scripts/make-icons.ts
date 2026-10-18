// アプリアイコン（Gemini で作った assets/icon-src.jpg）を各サイズの PNG にする
// 使い方: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'assets', 'icon-src.jpg');
const OUT = join(ROOT, 'public', 'icons');

// zoom: 絵のまわりの余白を切って拡大する割合。
// maskable は OS が外側を切るので（中央の 80% だけが安全）、拡大しない
const JOBS: { name: string; size: number; zoom: number }[] = [
  { name: 'icon-192.png', size: 192, zoom: 1.15 },
  { name: 'icon-512.png', size: 512, zoom: 1.15 },
  { name: 'apple-touch-icon.png', size: 180, zoom: 1.15 },
  { name: 'favicon-32.png', size: 32, zoom: 1.2 },
  { name: 'maskable-512.png', size: 512, zoom: 1 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { width = 0, height = 0 } = await sharp(SRC).metadata();
  const side = Math.min(width, height);
  for (const j of JOBS) {
    const crop = Math.round(side / j.zoom);
    await sharp(SRC)
      .extract({ left: Math.round((width - crop) / 2), top: Math.round((height - crop) / 2), width: crop, height: crop })
      .resize(j.size, j.size)
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, j.name));
    console.log(j.name);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
