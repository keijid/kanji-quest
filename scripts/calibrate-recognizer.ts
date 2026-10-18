// 判定のしきい値を決めるための集計（npx tsx scripts/calibrate-recognizer.ts）
import { KANA_POOL, KANJI_POOL, judge, toShape, templateOf, distance } from '../lib/recognize';
import { fakeHand } from '../tests/fake-hand';

function run(pool: readonly string[], label: string, mess: number) {
  let ok = 0, n = 0, wrongOk = 0, wn = 0;
  const fails: string[] = [];
  const ranks: number[] = [];
  const scores: number[] = [];
  pool.forEach((c, i) => {
    if (i % 2) return;
    for (let s = 0; s < 3; s++) {
      const hand = fakeHand(c, i * 31 + s, { mess, shuffle: true, joinProb: 0.15 });
      const j = judge(hand, c, pool);
      n++; ranks.push(j.rank); scores.push(j.score);
      if (j.ok) ok++; else fails.push(`${c}(r${j.rank} ${j.score.toFixed(3)} best ${j.best})`);
      // 別の字を書いたとき
      const other = pool[(i * 7 + s * 13 + 1) % pool.length];
      if (other !== c) { wn++; if (judge(hand, other, pool).ok) wrongOk++; }
    }
  });
  scores.sort((a, b) => a - b);
  void ranks;
  console.log(`${label} mess=${mess}: 正しい字の合格 ${(ok / n * 100).toFixed(1)}%  ちがう字の合格 ${(wrongOk / wn * 100).toFixed(1)}%  score p50=${scores[n >> 1].toFixed(3)} p95=${scores[Math.floor(n * 0.95)].toFixed(3)}`);
  if (fails.length) console.log('  不合格の例:', fails.slice(0, 12).join(' '));
}

for (const m of [0.5, 1, 1.5]) {
  run(KANJI_POOL, '漢字', m);
  run(KANA_POOL, 'かな', m);
}

// よく似た組の距離
const pairs = [['日', '目'], ['人', '入'], ['か', 'が'], ['は', 'ほ'], ['る', 'ろ'], ['め', 'ぬ'], ['右', '石']];
for (const [a, b] of pairs) {
  const tb = templateOf(b);
  console.log(`${a}→${b}: ${distance(toShape(fakeHand(a, 1, { mess: 1 })), tb).toFixed(3)}  ${a}→${a}: ${distance(toShape(fakeHand(a, 1, { mess: 1 })), templateOf(a)).toFixed(3)}`);
}
