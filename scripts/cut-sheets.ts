// Gemini で作った絵（横に並んだもの）を切り分けて public/ に置く
// 使い方: npx tsx scripts/cut-sheets.ts [bosses|modes|badges]
import { join } from 'node:path';
import { cutByComponents, cutSheet, type ComponentCutOptions, type CutOptions } from './lib/sheet';

const ROOT = join(__dirname, '..');
const gen = (f: string) => join(ROOT, 'assets', 'gen', f);
const pub = (f: string) => join(ROOT, 'public', f);

type Job = { by: 'columns'; o: CutOptions } | { by: 'components'; o: ComponentCutOptions };

const SHEETS: Record<string, Job> = {
  // ボス：4ステージごとに1体（左から 草原・森・雪山・さいごのボス）。
  // 雪のボスのマフラーと王さまの筆が横に重なるので、かたまりごとに振り分ける。白い毛が消えないよう背景の近さは小さく
  bosses: { by: 'components', o: { src: gen('bosses-sheet.jpg'), outFiles: [1, 2, 3, 4].map((n) => pub(`bosses/boss-${n}.png`)), boundaries: [0.255, 0.505, 0.765], bgTol: 14 } },
  // モードのアイコン（左から よみ・かき・かきじゅん・おくりがな）。矢印や飛行機の線は別のかたまりなので、かたまりごとに振り分ける
  modes: { by: 'components', o: { src: gen('modes-sheet.jpg'), outFiles: ['read', 'write', 'stroke', 'okuri'].map((m) => pub(`modes/${m}.png`)), boundaries: [0.27, 0.496, 0.734], bgTol: 14, size: 192 } },
  // 称号のバッジ（左から かけだし たびびと → かんじ マスター）。下に勝手に付いた英語の文字は捨てる
  badges: { by: 'components', o: { src: gen('badges-sheet.jpg'), outFiles: [1, 2, 3, 4, 5, 6].map((n) => pub(`badges/badge-${n}.png`)), boundaries: [0.17, 0.321, 0.481, 0.6475, 0.81], bgTol: 14, maxCenterY: 0.69, size: 192 } },
};

(async () => {
  const names = process.argv.slice(2);
  for (const n of names.length ? names : Object.keys(SHEETS)) {
    const j = SHEETS[n];
    if (j.by === 'columns') await cutSheet(j.o);
    else await cutByComponents(j.o);
  }
})().catch((e) => { console.error(e); process.exit(1); });
