// マップの背景（public/maps/<エリア>.jpg）を、横にくり返してもつなぎ目が出ない帯にする
// 絵とその左右反転を並べる（反転どうしはふちが一致するので、くり返してもなめらか）
// 出力: public/maps/<エリア>-strip.jpg ／ 使い方: npx tsx scripts/make-map-strips.ts
import sharp from 'sharp';
import { join } from 'node:path';

const MAPS = join(__dirname, '..', 'public', 'maps');
const H = 900; // マップの高さは最大 450px ほど（Retina で 900px）

(async () => {
  for (const n of ['meadow', 'forest', 'snow', 'castle']) {
    const src = sharp(join(MAPS, `${n}.jpg`)).resize({ height: H });
    const a = await src.toBuffer({ resolveWithObject: true });
    const b = await sharp(a.data).flop().toBuffer();
    const w = a.info.width;
    await sharp({ create: { width: w * 2, height: H, channels: 3, background: '#f6e4b8' } })
      .composite([{ input: a.data, left: 0, top: 0 }, { input: b, left: w, top: 0 }])
      .jpeg({ quality: 76, mozjpeg: true })
      .toFile(join(MAPS, `${n}-strip.jpg`));
    console.log(`${n}-strip.jpg ${w * 2}×${H}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
