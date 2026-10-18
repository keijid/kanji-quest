// 相棒のイラスト（5段階を横に並べた1枚の絵）を、段階ごとの透過 PNG に切り分ける
// 入力: assets/partners-src/<fire|wood|light>-sheet.jpg
// 出力: public/partners/<fire|wood|light>-<1..5>.png（384×384、背景は透明）
// 使い方: npm run partners
import { join } from 'node:path';
import { cutSheet } from './lib/sheet';

const ROOT = join(__dirname, '..');

// maxY：もこもこの絵は下に「STAGE 1」の文字があるので除く／enclosedTol：光の絵は体が背景に近いので、とじこめられた背景を消さない
const SHEETS = [
  { id: 'fire', maxY: 1, bgTol: 38, enclosedTol: 12 },
  { id: 'wood', maxY: 0.8, bgTol: 38, enclosedTol: 12 },
  { id: 'light', maxY: 1, bgTol: 30, enclosedTol: 0 },
];

(async () => {
  for (const s of SHEETS) {
    await cutSheet({
      ...s,
      src: join(ROOT, 'assets', 'partners-src', `${s.id}-sheet.jpg`),
      outFiles: [1, 2, 3, 4, 5].map((n) => join(ROOT, 'public', 'partners', `${s.id}-${n}.png`)),
    });
  }
})().catch((e) => { console.error(e); process.exit(1); });
