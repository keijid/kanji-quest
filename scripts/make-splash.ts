// iPad のホーム画面から開いたときの起動画面（apple-touch-startup-image）を作る
// 紙の色の地に、タイトル文字と相棒3体の絵（assets/gen/splash-group.jpg）を置く
// 出力: public/splash/<幅>x<高さ>.png ／ 使い方: npm run splash
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutByComponents } from './lib/sheet';

const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'splash');

/** iPad の画面（CSS ピクセル、縦向き）。すべて Retina（2倍） */
export const IPADS: [number, number][] = [
  [1032, 1376], // iPad Pro 13（M4）
  [1024, 1366], // iPad Pro 12.9
  [834, 1210], // iPad Pro 11（M4）
  [834, 1194], // iPad Pro 11 / iPad Air 11
  [820, 1180], // iPad Air 10.9 / iPad（第10世代）
  [810, 1080], // iPad 10.2
  [744, 1133], // iPad mini
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const group = join(ROOT, 'assets', 'gen', 'splash-group.png');
  await cutByComponents({ src: join(ROOT, 'assets', 'gen', 'splash-group.jpg'), outFiles: [group], boundaries: [], bgTol: 14, enclosedTol: 10, size: 1600 });
  const groupTrim = await sharp(group).trim().png().toBuffer();
  const title = join(ROOT, 'public', 'title.png');

  const list: { url: string; media: string }[] = [];
  for (const [cw, ch] of IPADS) {
    for (const orient of ['portrait', 'landscape'] as const) {
      const [w, h] = orient === 'portrait' ? [cw * 2, ch * 2] : [ch * 2, cw * 2];
      const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <defs><radialGradient id="g" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="#fbf0d4"/><stop offset="100%" stop-color="#ecd6a4"/></radialGradient></defs>
        <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
      const titleW = Math.round(Math.min(w * 0.62, h * 0.9));
      const titleBuf = await sharp(title).resize({ width: titleW }).toBuffer();
      const tH = (await sharp(titleBuf).metadata()).height!;
      const groupW = Math.round(Math.min(w * 0.7, h * 0.85));
      const groupBuf = await sharp(groupTrim).resize({ width: groupW, height: Math.round(h * 0.5), fit: 'inside' }).toBuffer();
      const gm = await sharp(groupBuf).metadata();
      const gap = Math.round(h * 0.04);
      const top = Math.round((h - (tH + gap + gm.height!)) / 2);
      const name = `${w}x${h}.png`;
      await sharp(bg)
        .composite([
          { input: titleBuf, left: Math.round((w - titleW) / 2), top },
          { input: groupBuf, left: Math.round((w - gm.width!) / 2), top: top + tH + gap },
        ])
        .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
        .toFile(join(OUT, name));
      list.push({ url: `/splash/${name}`, media: `(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: 2) and (orientation: ${orient})` });
      console.log(name);
    }
  }
  // app/layout.tsx が読む一覧
  writeFileSync(join(ROOT, 'data', 'splash.json'), JSON.stringify(list, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
