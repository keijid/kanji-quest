// 手書きの自動判定。KanjiVG のお手本と「形」だけを比べる（書き順・画の向きは見ない）。
//
// 1. 書いた線もお手本も、全体の外接矩形で大きさと位置をそろえる（縦横比は保つ）
// 2. 線を等間隔の点にして、点ごとに線の向きを持たせる
// 3. 向きつきの chamfer 距離（それぞれの点から、相手のいちばん近い点までの距離の平均）を両方向で取る
// 4. 候補（240字、またはひらがな）の中で順位を出し、甘めの条件で正解とする
import { KANJI, STROKES } from '../data';
import { pathToPoints, type Pt } from './svgPath';

export type Stroke = Pt[];
type Feat = { x: number; y: number; dx: number; dy: number };
type Shape = { pts: Feat[]; strokes: number };

const STEP = 0.025; // 点の間隔（正規化後の単位）
const DIR_W = 0.12; // 向きのちがいの重み
const STROKE_TOL = 2; // 画数のちがいを何画まで許すか

// 判定のしきい値（scripts/calibrate-recognizer.ts で調整、tests/recognize.test.ts で確認）
export const THRESH = {
  /** これより距離が大きければ、どの順位でも不正解 */
  absMax: 0.12,
  /** 1位でなくても、この順位以内で… */
  rank: 8,
  /** 1位との距離の差がこの割合以内なら正解 */
  margin: 0.35,
};
/** まず点を間引いて大まかに比べ、上位この数だけをきちんと比べる */
const COARSE_KEEP = 16;

function normalize(strokes: Stroke[]): Stroke[] {
  const all = strokes.flat();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of all) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY, 1e-6);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return strokes.map((s) => s.map((p) => ({ x: (p.x - cx) / size, y: (p.y - cy) / size })));
}

function resample(s: Stroke): Feat[] {
  if (s.length === 1) return [{ x: s[0].x, y: s[0].y, dx: 0, dy: 0 }];
  const out: Feat[] = [];
  let carry = 0;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
    let t = carry;
    while (t <= len) {
      out.push({ x: a.x + dx * t, y: a.y + dy * t, dx, dy });
      t += STEP;
    }
    carry = t - len;
  }
  const last = s[s.length - 1];
  const prev = out[out.length - 1];
  if (prev) out.push({ x: last.x, y: last.y, dx: prev.dx, dy: prev.dy });
  else out.push({ x: last.x, y: last.y, dx: 0, dy: 0 });
  return out;
}

export function toShape(strokes: Stroke[]): Shape {
  const usable = strokes.filter((s) => s.length > 0);
  return { pts: normalize(usable).flatMap(resample), strokes: usable.length };
}

const templateCache = new Map<string, Shape>();
export function templateOf(char: string): Shape {
  let t = templateCache.get(char);
  if (!t) {
    const paths = STROKES[char];
    if (!paths) throw new Error(`お手本がない: ${char}`);
    t = toShape(paths.map(pathToPoints));
    templateCache.set(char, t);
  }
  return t;
}

function oneWay(a: Feat[], b: Feat[]) {
  let sum = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d >= best) continue;
      // 向き：逆向きでも同じとみなす（書く向きは問わない）
      const v = d + DIR_W * (1 - Math.abs(p.dx * q.dx + p.dy * q.dy));
      if (v < best) best = v;
    }
    sum += best;
  }
  return sum / a.length;
}

export function distance(user: Shape, tpl: Shape) {
  const d = (oneWay(user.pts, tpl.pts) + oneWay(tpl.pts, user.pts)) / 2;
  const extra = Math.max(0, Math.abs(user.strokes - tpl.strokes) - STROKE_TOL);
  return d + extra * 0.015;
}

export type Judge = { ok: boolean; rank: number; score: number; best: string; bestScore: number };

const coarse = (sh: Shape): Shape => ({ pts: sh.pts.filter((_, i) => i % 3 === 0), strokes: sh.strokes });

/**
 * expected の字として書けているか。pool は比べる候補（expected を含めなくてもよい）。
 * 甘めに：1位でなくても、上位で1位との差が小さければ正解。
 * ただし「画数がぴったり合う別の字」のほうが近いとき（二と三、日と田 など）は不正解。
 */
export function judge(strokes: Stroke[], expected: string, pool: readonly string[]): Judge {
  const usable = strokes.filter((s) => s.length > 0);
  if (!usable.length) return { ok: false, rank: Infinity, score: Infinity, best: '', bestScore: Infinity };
  const user = toShape(usable);
  const cands = pool.includes(expected) ? pool : [...pool, expected];
  const uc = coarse(user);
  const rough = cands.map((c) => ({ c, s: distance(uc, coarse(templateOf(c))) })).sort((a, b) => a.s - b.s);
  const keep = rough.slice(0, COARSE_KEEP).map((x) => x.c);
  if (!keep.includes(expected)) keep.push(expected);
  const scored = keep.map((c) => ({ c, s: distance(user, templateOf(c)) })).sort((a, b) => a.s - b.s);
  // 大まかな比較で外れた字は、きちんと比べた字より下の順位とみなす
  const fineRank = scored.findIndex((x) => x.c === expected);
  const rank = fineRank < COARSE_KEEP ? fineRank : rough.findIndex((x) => x.c === expected);
  const score = scored[fineRank].s;
  const best = scored[0];
  const exp = templateOf(expected);
  const confusable = best.c !== expected && templateOf(best.c).strokes === user.strokes && exp.strokes !== user.strokes;
  const ok = score <= THRESH.absMax && !confusable && (rank === 0 || (rank < THRESH.rank && score <= best.s * (1 + THRESH.margin)));
  return { ok, rank, score, best: best.c, bestScore: best.s };
}

// 候補の集まり
export const KANJI_POOL: readonly string[] = KANJI.map((k) => k.char);
/** 小さい字（ゃ など）は大きい字と同じ形として扱う */
const SMALL: Record<string, string> = { ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ' };
export const KANA_POOL: readonly string[] = Object.keys(STROKES).filter((c) => /[ぁ-ゖー]/.test(c) && !SMALL[c]);
export const kanaBase = (c: string) => SMALL[c] ?? c;

/** ひらがな1字の判定 */
export const judgeKana = (strokes: Stroke[], expected: string) => judge(strokes, kanaBase(expected), KANA_POOL);
/** 漢字1字の判定 */
export const judgeKanji = (strokes: Stroke[], expected: string) => judge(strokes, expected, KANJI_POOL);
