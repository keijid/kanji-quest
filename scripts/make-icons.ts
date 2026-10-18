// アプリアイコン（KanjiQuest Logo.dc.html の「アプリアイコン」）を PNG にする
// 使い方: npx tsx scripts/make-icons.ts
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(__dirname, '..', 'public', 'icons');

// rounded: 角丸＋外枠つき（purpose any）／ full: 全面を塗る（iOS・maskable。角丸は OS が付ける）
const html = (size: number, rounded: boolean) => {
  const s = size / 180;
  const shieldW = rounded ? 110 * s : 96 * s;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:transparent}
.icon{width:${size}px;height:${size}px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;
background:radial-gradient(ellipse at center,#fbf0d4 55%,#ecd6a4 100%);
${rounded ? `border-radius:${40 * s}px;border:${6 * s}px solid #8a5a34;` : ''}}
.shield{width:${shieldW}px;height:${shieldW * 126 / 110}px;background:#b8321f;clip-path:polygon(50% 0,100% 12%,100% 55%,50% 100%,0 55%,0 12%);
display:flex;align-items:center;justify-content:center;padding-bottom:${shieldW * 14 / 110}px;box-sizing:border-box;
font-family:'Yusei Magic';font-size:${shieldW * 62 / 110}px;color:#fbf0d4}</style></head>
<body><div class="icon"><div class="shield">字</div></div></body></html>`;
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const jobs: [string, number, boolean][] = [
    ['icon-192.png', 192, true],
    ['icon-512.png', 512, true],
    ['maskable-512.png', 512, false],
    ['apple-touch-icon.png', 180, false],
    ['favicon-32.png', 32, true],
  ];
  for (const [name, size, rounded] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html(size, rounded), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.icon').screenshot({ path: join(OUT, name), omitBackground: true });
    console.log(name);
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
