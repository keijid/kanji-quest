// 勇者の 全身の 絵（public/heroes/hero-<段階>.png）から、ヘッダーに 出す 顔の アイコンを 切り出す
// 出力: public/heroes/face-<段階>.png（128×128、背景は透明）
// 使い方: npx tsx scripts/make-hero-faces.ts（先に npx tsx scripts/cut-sheets.ts heroes）
//         --preview <ファイル> で 6つを 横に ならべた 確認用の 絵も 書き出す
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(__dirname, '..');
const SIZE = 128;
/** 顔と むねの まわりの 正方形 [中心x, 中心y, 一辺]（384px の 全身の 絵の 中で。目で 見て きめた） */
const BOX: [number, number, number][] = [[192, 92, 172], [186, 92, 172], [190, 92, 172], [186, 96, 180], [184, 96, 180], [183, 140, 140]];

(async () => {
  const faces = await Promise.all(BOX.map(async ([cx, cy, s], i) => {
    const left = Math.round(cx - s / 2), top = Math.max(0, Math.round(cy - s / 2));
    const buf = await sharp(join(ROOT, 'public', 'heroes', `hero-${i + 1}.png`)).extract({ left, top, width: s, height: s }).resize(SIZE, SIZE).png().toBuffer();
    await sharp(buf).toFile(join(ROOT, 'public', 'heroes', `face-${i + 1}.png`));
    return buf;
  }));
  const at = process.argv.indexOf('--preview');
  if (at > 0) {
    await sharp({ create: { width: SIZE * faces.length, height: SIZE, channels: 4, background: '#fbf0d4' } })
      .composite(faces.map((input, i) => ({ input, left: i * SIZE, top: 0 })))
      .png().toFile(process.argv[at + 1]);
  }
})().catch((e) => { console.error(e); process.exit(1); });
