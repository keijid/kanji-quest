// Gemini で作った絵（横に並んだもの）を切り分けて public/ に置く
// 使い方: npx tsx scripts/cut-sheets.ts [bosses-family-1|…|midboss-1|modes|heroes]
import { join } from 'node:path';
import { cutByComponents, cutSheet, type ComponentCutOptions, type CutOptions } from './lib/sheet';

const ROOT = join(__dirname, '..');
const gen = (f: string) => join(ROOT, 'assets', 'gen', f);
const pub = (f: string) => join(ROOT, 'public', f);
const boss = (stage: number) => pub(`bosses/stage-${stage}.png`);

type Job = { by: 'columns'; o: CutOptions } | { by: 'components'; o: ComponentCutOptions };

const SHEETS: Record<string, Job> = {
  // ボス：ステージごとに1体（public/bosses/stage-<ステージ>.png）。お父さん（奇数）・お母さん（偶数）が ステージに あった 着ぐるみで おこっている。さいごは 2人いっしょ
  // 筆や しずくが となりと 横に 重なるので、かたまりごとに 振り分ける。白い 毛が 消えないよう 背景の 近さは 小さく
  'bosses-family-1': { by: 'components', o: { src: gen('bosses-family-1-sheet.jpg'), outFiles: [1, 2, 3, 4].map(boss), boundaries: [0.25, 0.49, 0.735], bgTol: 14 } },
  'bosses-family-2': { by: 'components', o: { src: gen('bosses-family-2-sheet.jpg'), outFiles: [5, 6, 7, 8].map(boss), boundaries: [0.27, 0.51, 0.75], bgTol: 14 } },
  'bosses-family-3': { by: 'components', o: { src: gen('bosses-family-3-sheet.jpg'), outFiles: [9, 10, 11, 12].map(boss), boundaries: [0.255, 0.5, 0.75], bgTol: 14 } },
  'bosses-family-4': { by: 'components', o: { src: gen('bosses-family-4-sheet.jpg'), outFiles: [13, 14, 15, 16].map(boss), boundaries: [0.26, 0.48, 0.71], bgTol: 14 } },
  // たおしたあとの ニッコリ顔（public/bosses/stage-<ステージ>-happy.png）。おこった 絵を もとに 顔だけ 描きかえたので、切り分け方は 同じ
  ...Object.fromEntries(([[1, [0.25, 0.49, 0.735]], [2, [0.27, 0.51, 0.75]], [3, [0.255, 0.5, 0.75]], [4, [0.26, 0.48, 0.71]]] as const).map(([n, boundaries]): [string, Job] => [
    `bosses-family-${n}-happy`,
    { by: 'components', o: { src: gen(`bosses-family-${n}-happy-sheet.jpg`), outFiles: [1, 2, 3, 4].map((k) => pub(`bosses/stage-${(n - 1) * 4 + k}-happy.png`)), boundaries: [...boundaries], bgTol: 14 } },
  ])),
  'bosses-family-14-happy': { by: 'components', o: { src: gen('bosses-family-14-happy.jpg'), outFiles: [pub('bosses/stage-14-happy.png')], boundaries: [], bgTol: 14 } },
  // 14（お母さんの 月のうさぎ）は 上の 絵では 笑っていたので、1体だけ 描き直した 絵で 上書きする（上の ジョブより 後に 置く）
  'bosses-family-14': { by: 'components', o: { src: gen('bosses-family-14.jpg'), outFiles: [boss(14)], boundaries: [], bgTol: 14 } },
  // 中ボス（public/bosses/mid-<番号>.png。1＝おまわりさん、2＝インフルエンサー）。たおしたあとは -happy。おまわりさんは 敬礼の うでと 顔の あいだの 白も 消す
  ...Object.fromEntries([1, 2].flatMap((n) => ['', '-happy'].map((h): [string, Job] => [
    `midboss-${n}${h}`,
    { by: 'components', o: { src: gen(`midboss-${n}${h}.jpg`), outFiles: [pub(`bosses/mid-${n}${h}.png`)], boundaries: [], bgTol: 14, ...(n === 1 ? { enclosedTol: 10 } : {}) } },
  ]))),
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
