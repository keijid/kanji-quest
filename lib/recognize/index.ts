// 手書きの自動判定。KanjiVG のお手本と「形」だけを比べる（書き順・画の向きは見ない）。
//
// 1. 書いた線もお手本も、全体の外接矩形で大きさと位置をそろえる（縦横比は保つ）
// 2. 線を等間隔の点にして、点ごとに線の向きを持たせる
// 3. 向きつきの chamfer 距離（それぞれの点から、相手のいちばん近い点までの距離の平均）を両方向で取る
// 4. 候補（240字、またはひらがな）の中で順位を出し、甘めの条件で正解とする
import { ALL_KANJI, STROKES } from '../data';
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

/**
 * お手本（KanjiVG）と 形が だいぶ ちがうが、子どもが よく 書く 形（同じ 0〜109 の 座標）。
 * よ：たて画を 左に、わを 細く 書いて、右へ 長く はらう（「しょうご」の ょ が 落ちた）
 */
const VARIANTS: Record<string, string[][]> = {
  よ: [[
    'M49,31C60,30,72,30,82,29',
    'M42,14C42,40,42,65,42,87C42,91,30,92,28,89C25,82,25,70,30,62C34,58,45,64,52,69C62,75,70,77,77,79',
  ]],
};
const variantCache = new Map<string, Shape[]>();
/** お手本と、子どもが よく 書く 形 */
function templatesOf(char: string): Shape[] {
  let ts = variantCache.get(char);
  if (!ts) {
    ts = [templateOf(char), ...(VARIANTS[char] ?? []).map((v) => toShape(v.map(pathToPoints)))];
    variantCache.set(char, ts);
  }
  return ts;
}

/** その字の いちばん 近い 形との 距離と、その形の 画数 */
function closest(user: Shape, char: string, f: (s: Shape) => Shape = (s) => s) {
  let best = { s: Infinity, strokes: 0 };
  for (const t of templatesOf(char)) {
    const s = distance(user, f(t));
    if (s < best.s) best = { s, strokes: t.strokes };
  }
  return best;
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
export function judge(strokes: Stroke[], expected: string, pool: readonly string[], th: typeof THRESH = THRESH): Judge {
  const usable = strokes.filter((s) => s.length > 0);
  if (!usable.length) return { ok: false, rank: Infinity, score: Infinity, best: '', bestScore: Infinity };
  const user = toShape(usable);
  const cands = pool.includes(expected) ? pool : [...pool, expected];
  const uc = coarse(user);
  const rough = cands.map((c) => ({ c, s: closest(uc, c, coarse).s })).sort((a, b) => a.s - b.s);
  const keep = rough.slice(0, COARSE_KEEP).map((x) => x.c);
  if (!keep.includes(expected)) keep.push(expected);
  const scored = keep.map((c) => ({ c, ...closest(user, c) })).sort((a, b) => a.s - b.s);
  // 大まかな比較で外れた字は、きちんと比べた字より下の順位とみなす
  const fineRank = scored.findIndex((x) => x.c === expected);
  const rank = fineRank < COARSE_KEEP ? fineRank : rough.findIndex((x) => x.c === expected);
  const score = scored[fineRank].s;
  const best = scored[0];
  const expStrokes = templatesOf(expected).map((t) => t.strokes);
  const confusable = best.c !== expected && best.strokes === user.strokes && !expStrokes.includes(user.strokes);
  const ok = score <= th.absMax && !confusable && (rank === 0 || (rank < th.rank && score <= best.s * (1 + th.margin)));
  return { ok, rank, score, best: best.c, bestScore: best.s };
}

// 候補の集まり
// 小1の字も候補に入れる（形の似た字とまちがえていないかを見るため）
export const KANJI_POOL: readonly string[] = ALL_KANJI.map((k) => k.char);
/** 小さい字（ゃ など）は大きい字と同じ形として扱う */
const SMALL: Record<string, string> = { ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ' };
export const KANA_POOL: readonly string[] = Object.keys(STROKES).filter((c) => /[ぁ-ゖー]/.test(c) && !SMALL[c]);
export const kanaBase = (c: string) => SMALL[c] ?? c;

/** ひらがなは 漢字より 少し ゆるめに（にた字（あ・お など）を とりちがえない はんいで） */
const KANA_THRESH: typeof THRESH = { absMax: 0.14, rank: 8, margin: 0.5 };
/** ひらがな1字の判定。loose なら もっと ゆるめに（長い 答えで 1字だけ 落ちた ときの 見直し用） */
const KANA_LOOSE: typeof THRESH = { absMax: 0.16, rank: 12, margin: 0.8 };
// 小さい字（ょ など）は マスの 中に 小さく 書くので 形が くずれやすく、いつも ゆるめに 見る
// （「きょうかしょ」のように 小さい字が 2つ あると、1字だけの 見直しでは 助けられない）
export const judgeKana = (strokes: Stroke[], expected: string, loose = false) =>
  judge(strokes, kanaBase(expected), KANA_POOL, loose || SMALL[expected] ? KANA_LOOSE : KANA_THRESH);
/** 漢字1字の判定 */
export const judgeKanji = (strokes: Stroke[], expected: string) => judge(strokes, expected, KANJI_POOL);

// ---- 5回れんしゅう：お手本の 画が ぜんぶ 書けているか ----
// 形が にているだけだと、画が 1本 ぬけても 合格に なってしまう（「家」の 一 が ない など）。
// 書いた字を お手本に 重ねて、お手本の 画 1本ずつ、近くに 書いた線が あるかを 見る。

/** お手本の 画1本の 点から、書いた線までの 平均距離が これを こえたら「その画が ない」（tests/recognize.test.ts で確認） */
const MISS_MAX = 0.115;
/**
 * 写して 書く ときの 形の 判定は、問題（THRESH）より ずっと ゆるめに（お手本を 見ながら 書くので、ちがう字には まず ならない）。
 * 「遠」の しんにょう など、画を つなげて 書くと 画数が へり、画数の 近い 別の字（通・東 など）が 上の 順位に 来るので、順位は 大きく ゆるす
 */
const COPY_THRESH: typeof THRESH = { absMax: 0.15, rank: 80, margin: 1.5 };
/** 重ねるときに 変形してよい はんい（ぬけた画を ごまかさない ように、のばしすぎ・かたむけすぎない） */
const ALIGN_SCALE: [number, number] = [0.75, 1.3];
const ALIGN_SHEAR = 0.3;
const ALIGN_ITER = 6;

/** 3元 連立1次方程式（ガウスの 消去法）。とけないときは null */
function solve3(m: number[][], v: number[]): number[] | null {
  const a = m.map((r, i) => [...r, v[i]]);
  for (let i = 0; i < 3; i++) {
    let piv = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(a[k][i]) > Math.abs(a[piv][i])) piv = k;
    [a[i], a[piv]] = [a[piv], a[i]];
    if (Math.abs(a[i][i]) < 1e-12) return null;
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const f = a[k][i] / a[i][i];
      for (let j = i; j < 4; j++) a[k][j] -= f * a[i][j];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

const nearest = (p: Pt, pts: Pt[]) => {
  let best = pts[0], bd = Infinity;
  for (const q of pts) {
    const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    if (d < bd) { bd = d; best = q; }
  }
  return best;
};

/** 書いた字の かたむき・ゆがみを、お手本に 合わせる（いちばん近い点どうしを 対応させて アフィン変換を くり返す） */
function alignTo(user: Stroke[], tpl: Pt[]): Stroke[] {
  const lim = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const tplHalf = tpl.filter((_, i) => i % 2 === 0);
  let cur = user;
  for (let it = 0; it < ALIGN_ITER; it++) {
    const flat = cur.flat();
    const pairs: [Pt, Pt][] = [
      ...flat.filter((_, i) => i % 2 === 0).map((p): [Pt, Pt] => [p, nearest(p, tpl)]),
      ...tplHalf.map((q): [Pt, Pt] => [nearest(q, flat), q]),
    ];
    let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, xx = 0, xy = 0, x1 = 0, yx = 0, yy = 0, y1 = 0;
    for (const [p, q] of pairs) {
      sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y; sx += p.x; sy += p.y;
      xx += q.x * p.x; xy += q.x * p.y; x1 += q.x;
      yx += q.y * p.x; yy += q.y * p.y; y1 += q.y;
    }
    const m = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, pairs.length]];
    const rx = solve3(m, [xx, xy, x1]), ry = solve3(m, [yx, yy, y1]);
    // 点が 1か所に かたまっている（点だけ など）ときは 合わせない
    if (!rx || !ry) break;
    const [a0, b0, c] = rx, [d0, e0, f] = ry;
    const a = lim(a0, ...ALIGN_SCALE), e = lim(e0, ...ALIGN_SCALE);
    const b = lim(b0, -ALIGN_SHEAR, ALIGN_SHEAR), d = lim(d0, -ALIGN_SHEAR, ALIGN_SHEAR);
    cur = cur.map((s) => s.map((p) => ({ x: a * p.x + b * p.y + c, y: d * p.x + e * p.y + f })));
  }
  return cur;
}

/**
 * 画ごとに 見る ときの、まわりの ずれの 合わせかた。
 * 字ぜんたいを 合わせても、へんと つくりの 高さが ずれて いると（「語」の 五 が 下に ある など）、
 * 書けている 画まで「ない」に なる。そこで その画の まわり（LOCAL_R 以内）の ほかの 画で、ずれを はかって 合わせる。
 * その画 自身は 使わない（ぬけた画が となりの 線に 引きよせられて「ある」に ならない ように）
 */
const LOCAL_R = 0.2;
const LOCAL_SHIFT = 0.05;
const LOCAL_ITER = 4;

/** お手本の 画ごとに、書いた線までの 平均距離を かえす（大きい 画ほど 書けていない） */
function strokeGaps(strokes: Stroke[], expected: string): number[] {
  const usable = strokes.filter((s) => s.length > 0);
  const tpl = normalize(STROKES[expected].map(pathToPoints)).map(resample);
  const user = alignTo(normalize(usable), tpl.flat()).flatMap(resample);
  const gapOf = (st: Feat[], ox: number, oy: number) => {
    let sum = 0;
    for (const p of st) {
      let best = Infinity;
      for (const q of user) {
        const d = Math.hypot(p.x + ox - q.x, p.y + oy - q.y);
        if (d >= best) continue;
        const v = d + DIR_W * (1 - Math.abs(p.dx * q.dx + p.dy * q.dy));
        if (v < best) best = v;
      }
      sum += best;
    }
    return sum / st.length;
  };
  return tpl.map((st, k) => {
    const cx = st.reduce((a, p) => a + p.x, 0) / st.length, cy = st.reduce((a, p) => a + p.y, 0) / st.length;
    const near = tpl.flatMap((t, j) => (j === k ? [] : t)).filter((p) => Math.hypot(p.x - cx, p.y - cy) < LOCAL_R);
    let ox = 0, oy = 0;
    if (near.length >= 4) {
      for (let it = 0; it < LOCAL_ITER; it++) {
        let sx = 0, sy = 0;
        for (const p of near) {
          const q = nearest({ x: p.x + ox, y: p.y + oy }, user);
          sx += q.x - p.x; sy += q.y - p.y;
        }
        ox = sx / near.length; oy = sy / near.length;
        const l = Math.hypot(ox, oy);
        if (l > LOCAL_SHIFT) { ox *= LOCAL_SHIFT / l; oy *= LOCAL_SHIFT / l; }
      }
    }
    return gapOf(st, ox, oy);
  });
}

export type CopyResult = {
  ok: boolean;
  /** 書けていない（近くに 線が ない）お手本の 画（0始まり） */
  missing: number[];
  /** だめだった わけ：画数が 足りない・多すぎる・画が ぬけている・形が ちがう */
  reason?: 'few' | 'many' | 'missing' | 'shape';
};

/**
 * お手本を見て 写す れんしゅう の判定。形が その字と みとめられ、画数も ほぼ足りていて、
 * お手本の 画が 1本も ぬけていないこと
 * （写して書くので、画数が 大きく足りないものは だめ。つなげて書く分は 1/4 まで ゆるす）
 * 余分な線（「高」の 口の 中の ななめ線 など）は 形の 近さでは 見分けられないので、画数で 見る。
 * 折れを 2本に 分けて 書く分として 1画だけ ゆるす
 */
export function checkCopy(strokes: Stroke[], expected: string): CopyResult {
  const total = STROKES[expected]?.length ?? 0;
  const usable = strokes.filter((s) => s.length > 0);
  if (!usable.length) return { ok: false, missing: [], reason: 'few' };
  const missing = strokeGaps(usable, expected).flatMap((g, i) => (g > MISS_MAX ? [i] : []));
  if (usable.length < total - Math.ceil(total / 4)) return { ok: false, missing, reason: 'few' };
  if (usable.length > total + 1) return { ok: false, missing, reason: 'many' };
  if (missing.length) return { ok: false, missing, reason: 'missing' };
  if (!judge(usable, expected, KANJI_POOL, COPY_THRESH).ok) return { ok: false, missing, reason: 'shape' };
  return { ok: true, missing };
}

export const judgeCopy = (strokes: Stroke[], expected: string) => checkCopy(strokes, expected).ok;
