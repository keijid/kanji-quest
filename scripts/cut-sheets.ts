// Gemini で作った絵（横に並んだもの）を切り分けて public/ に置く
// 使い方: npx tsx scripts/cut-sheets.ts [bosses|modes|heroes]
import { join } from 'node:path';
import { cutByComponents, cutSheet, type ComponentCutOptions, type CutOptions } from './lib/sheet';

const ROOT = join(__dirname, '..');
const gen = (f: string) => join(ROOT, 'assets', 'gen', f);
const pub = (f: string) => join(ROOT, 'public', f);
const boss = (stage: number) => pub(`bosses/stage-${stage}.png`);

type Job = { by: 'columns'; o: CutOptions } | { by: 'components'; o: ComponentCutOptions };

const SHEETS: Record<string, Job> = {
  // ボス：ステージごとに1体（public/bosses/stage-<ステージ>.png）。最初の4体は各エリアのさいご（4・8・12・16）。
  // 筆やマフラーがとなりと横に重なるので、かたまりごとに振り分ける。白い毛が消えないよう背景の近さは小さく
  bosses: { by: 'components', o: { src: gen('bosses-sheet.jpg'), outFiles: [4, 8, 12, 16].map(boss), boundaries: [0.255, 0.505, 0.765], bgTol: 14 } },
  'bosses-a': { by: 'components', o: { src: gen('bosses-a-sheet.jpg'), outFiles: [1, 2, 3, 5].map(boss), boundaries: [0.265, 0.505, 0.7375], bgTol: 14 } },
  'bosses-b': { by: 'components', o: { src: gen('bosses-b-sheet.jpg'), outFiles: [6, 7, 9, 10].map(boss), boundaries: [0.27, 0.51, 0.75], bgTol: 14 } },
  'bosses-c': { by: 'components', o: { src: gen('bosses-c-sheet.jpg'), outFiles: [11, 13, 14, 15].map(boss), boundaries: [0.26, 0.5125, 0.7575], bgTol: 14 } },
  // モードのアイコン（左から よみ・かき・かきじゅん・おくりがな）。矢印や飛行機の線は別のかたまりなので、かたまりごとに振り分ける
  modes: { by: 'components', o: { src: gen('modes-sheet.jpg'), outFiles: ['read', 'write', 'stroke', 'okuri'].map((m) => pub(`modes/${m}.png`)), boundaries: [0.27, 0.496, 0.734], bgTol: 14, size: 192 } },
  // 勇者（自分の分身）：称号の 段階ごとに 1まい（public/heroes/hero-<段階>.png、左から かけだし → マスター）。下に 勝手に 付いた 英語の 文字は 捨てる
  heroes: { by: 'components', o: { src: gen('heroes-c-sheet.jpg'), outFiles: [1, 2, 3, 4, 5, 6].map((n) => pub(`heroes/hero-${n}.png`)), boundaries: [0.15, 0.305, 0.468, 0.632, 0.79], bgTol: 14, maxCenterY: 0.9, size: 384 } },
  // 相棒の表情（よろこぶ・はげます・おどろく）。5段階を横に並べた絵から public/partners/<相棒>-<段階>-<表情>.png
  ...Object.fromEntries((['fire', 'wood', 'light'] as const).flatMap((id) => (['happy', 'cheer', 'surprised'] as const).map((m): [string, Job] => [
    `${id}-${m}`,
    { by: 'components', o: { src: gen(`moods/${id}-${m}-sheet.jpg`), outFiles: [1, 2, 3, 4, 5].map((n) => pub(`partners/${id}-${n}-${m}.png`)), boundaries: 'auto', bgTol: 14, enclosedTol: 10 } },
  ]))),
};

(async () => {
  const names = process.argv.slice(2);
  for (const n of names.length ? names : Object.keys(SHEETS)) {
    const j = SHEETS[n];
    if (j.by === 'columns') await cutSheet(j.o);
    else await cutByComponents(j.o);
  }
})().catch((e) => { console.error(e); process.exit(1); });
