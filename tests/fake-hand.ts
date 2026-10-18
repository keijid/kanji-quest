// 判定のテスト用に、お手本から「子どもが書いたような」線を作る
import { STROKES } from '@/lib/data';
import { pathToPoints, type Pt } from '@/lib/recognize/svgPath';

/** 再現できる乱数 */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export type HandOpts = {
  /** ゆがみの強さ 0〜1 */
  mess: number;
  /** 書き順・向きを入れかえる */
  shuffle?: boolean;
  /** となりの画をつなげて書く確率 */
  joinProb?: number;
};

export function fakeHand(char: string, seed: number, o: HandOpts): Pt[][] {
  const r = rng(seed);
  const g = (a: number) => (r() * 2 - 1) * a;
  const m = o.mess;
  // 全体のゆがみ（回転・せん断・縦横の伸び縮み）
  const rot = g(0.12 * m), sh = g(0.15 * m), sx = 1 + g(0.2 * m), sy = 1 + g(0.2 * m);
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const tf = (p: Pt): Pt => {
    const x = (p.x - 54.5) * sx + (p.y - 54.5) * sh, y = (p.y - 54.5) * sy;
    return { x: 160 + (x * cos - y * sin) * 2.6, y: 160 + (x * sin + y * cos) * 2.6 };
  };
  let strokes = STROKES[char].map((d) => {
    const pts = pathToPoints(d).map(tf);
    // 画ごとのずれ（位置）と、ふるえ（なめらかなノイズ）
    const ox = g(10 * m), oy = g(10 * m);
    const ph = r() * 6, amp = 4 * m;
    return pts.map((p, i) => ({ x: p.x + ox + Math.sin(i * 0.7 + ph) * amp + g(1.5 * m), y: p.y + oy + Math.cos(i * 0.6 + ph) * amp + g(1.5 * m) }));
  });
  if (o.joinProb) {
    const joined: Pt[][] = [];
    for (const s of strokes) {
      if (joined.length && r() < o.joinProb) joined[joined.length - 1] = [...joined[joined.length - 1], ...s];
      else joined.push(s);
    }
    strokes = joined;
  }
  if (o.shuffle) {
    strokes = strokes.map((s) => (r() < 0.5 ? [...s].reverse() : s));
    for (let i = strokes.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [strokes[i], strokes[j]] = [strokes[j], strokes[i]];
    }
  }
  return strokes;
}
