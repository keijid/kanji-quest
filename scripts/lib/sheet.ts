// 横に並んだ複数の絵（単色の背景）を、1つずつ背景を透明にした PNG に切り分ける
// 輪郭線（こげ茶）の列で絵を分け、外側から背景をたどって透明にする
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DARK = 120; // 輪郭線（こげ茶）とみなす明るさ
export type CutOptions = {
  /** 横に並んだ絵（背景は単色） */
  src: string;
  /** 左から順に書き出すファイル。数＝絵の数 */
  outFiles: string[];
  /** これより下は見ない（「STAGE 1」などの文字を除く）。高さに対する割合 */
  maxY?: number;
  /** 背景とみなす色の近さ（RGB の距離）。光のエフェクトがある絵は大きめ */
  bgTol?: number;
  /** とじこめられた背景を消すときの色の近さ。0 なら消さない（体の色が背景に近い絵） */
  enclosedTol?: number;
  /** 書き出す正方形の一辺 */
  size?: number;
};

/** 横に並んだ絵を、1つずつ背景を透明にした正方形の PNG に切り分ける */
export async function cutSheet(o: CutOptions) {
  const sheet = { maxY: o.maxY ?? 1, bgTol: o.bgTol ?? 38, enclosedTol: o.enclosedTol ?? 12 };
  const GROUPS = o.outFiles.length;
  const SIZE = o.size ?? 384;
  const { data, info } = await sharp(o.src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = Math.floor(info.height * sheet.maxY);
  const px = (x: number, y: number) => (y * info.width + x) * 3;
  const lum = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

  // 背景色＝四隅付近の中央値
  const samples: number[][] = [];
  for (const [x, y] of [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5], [W >> 1, 4]]) {
    const i = px(x, y);
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  const bg = [0, 1, 2].map((c) => samples.map((s) => s[c]).sort((a, b) => a - b)[2]);
  const dist = (i: number) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);

  // 輪郭線の列ごとの量 → キャラクターのある列のまとまり
  const col = new Array(W).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (lum(px(x, y)) < DARK) col[x]++;
  let runs: [number, number][] = [];
  for (let x = 0; x < W; x++) {
    if (col[x] > 0) {
      if (runs.length && x - runs[runs.length - 1][1] <= 1) runs[runs.length - 1][1] = x;
      else runs.push([x, x]);
    }
  }
  // すきまの小さいところからつないで、絵の数にする
  while (runs.length > GROUPS) {
    let best = 0;
    for (let i = 1; i < runs.length - 1; i++) if (runs[i + 1][0] - runs[i][1] < runs[best + 1][0] - runs[best][1]) best = i;
    runs = [...runs.slice(0, best), [runs[best][0], runs[best + 1][1]], ...runs.slice(best + 2)];
  }
  // 炎などでとなりとつながっていて足りないときは、いちばん幅の広いまとまりを輪郭線のいちばん少ない列で分ける
  while (runs.length < GROUPS) {
    let wi = 0;
    runs.forEach((r, i) => { if (r[1] - r[0] > runs[wi][1] - runs[wi][0]) wi = i; });
    const [a, b] = runs[wi];
    let cutX = a, low = Infinity;
    for (let x = a + Math.floor((b - a) * 0.2); x <= b - Math.floor((b - a) * 0.2); x++) if (col[x] < low) { low = col[x]; cutX = x; }
    runs = [...runs.slice(0, wi), [a, cutX - 1], [cutX + 1, b], ...runs.slice(wi + 1)];
  }

  for (let g = 0; g < GROUPS; g++) {
    // 切り出す範囲：となりとのすきまの真ん中まで
    const x0 = g === 0 ? 0 : Math.floor((runs[g - 1][1] + runs[g][0]) / 2);
    const x1 = g === GROUPS - 1 ? W - 1 : Math.floor((runs[g][1] + runs[g + 1][0]) / 2);
    const w = x1 - x0 + 1;

    // 外側から、背景に近い色をたどって透明にする（輪郭の内側のおなか等は残る）
    const alpha = new Uint8Array(w * H).fill(255);
    const seen = new Uint8Array(w * H);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
      const k = y * w + x;
      if (seen[k]) return;
      seen[k] = 1;
      if (dist(px(x + x0, y)) < sheet.bgTol) stack.push(k);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % w, y = (k / w) | 0;
      alpha[k] = 0;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < H - 1) push(x, y + 1);
    }

    // 炎の輪の内側など、とじこめられた背景（背景色とほぼ同じ色の広い部分）も透明にする。
    // おなかのクリーム色は背景と 30 ほどちがうので、近さ 12 未満だけを対象にする（光の絵は体が背景に近いので消さない）
    const ENCLOSED_TOL = sheet.enclosedTol, ENCLOSED_MIN = 400;
    const vis = new Uint8Array(w * H);
    for (let k0 = 0; k0 < w * H; k0++) {
      if (!alpha[k0] || vis[k0]) continue;
      const x0k = k0 % w, y0k = (k0 / w) | 0;
      if (dist(px(x0k + x0, y0k)) >= ENCLOSED_TOL) continue;
      const region = [k0], q = [k0];
      vis[k0] = 1;
      while (q.length) {
        const k = q.pop()!;
        const x = k % w, y = (k / w) | 0;
        for (const n of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < H - 1 ? k + w : -1]) {
          if (n < 0 || vis[n] || !alpha[n]) continue;
          if (dist(px((n % w) + x0, (n / w) | 0)) >= ENCLOSED_TOL) continue;
          vis[n] = 1; region.push(n); q.push(n);
        }
      }
      if (region.length >= ENCLOSED_MIN) for (const k of region) alpha[k] = 0;
    }

    // となりのキャラの切れはし（左右のはしにかかった小さなかけら）を消す
    const label = new Int32Array(w * H).fill(-1);
    const comps: { size: number; edge: boolean }[] = [];
    let total = 0;
    for (let k0 = 0; k0 < w * H; k0++) {
      if (!alpha[k0] || label[k0] >= 0) continue;
      const id = comps.length, q = [k0];
      label[k0] = id;
      let size = 0, edge = false;
      while (q.length) {
        const k = q.pop()!;
        size++;
        const x = k % w, y = (k / w) | 0;
        if (x === 0 || x === w - 1) edge = true;
        for (const n of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < H - 1 ? k + w : -1]) {
          if (n >= 0 && alpha[n] && label[n] < 0) { label[n] = id; q.push(n); }
        }
      }
      comps.push({ size, edge });
      total += size;
    }
    for (let k = 0; k < w * H; k++) if (label[k] >= 0 && comps[label[k]].edge && comps[label[k]].size < total * 0.05) alpha[k] = 0;

    // 残った部分の外接矩形
    let minX = w, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] > 0) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const rgba = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const s = px(x + minX + x0, y + minY), d = (y * bw + x) * 4;
      rgba[d] = data[s]; rgba[d + 1] = data[s + 1]; rgba[d + 2] = data[s + 2];
      rgba[d + 3] = alpha[(y + minY) * w + x + minX];
    }

    // 正方形のまん中に置く（円の中に収まるよう、すこし余白をとる）
    const side = Math.round(Math.max(bw, bh) * 1.1);
    const file = o.outFiles[g];
    mkdirSync(dirname(file), { recursive: true });
    // sharp は resize を composite より先に行うので、2回に分ける
    const square = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: rgba, raw: { width: bw, height: bh, channels: 4 }, left: Math.round((side - bw) / 2), top: Math.round((side - bh) / 2) }])
      .png()
      .toBuffer();
    await sharp(square).resize(SIZE, SIZE).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(file);
    console.log(`${file}  ${bw}×${bh}`);
  }
}


export type ComponentCutOptions = {
  src: string;
  outFiles: string[];
  /**
   * 絵どうしの境目（横位置の割合 0〜1）。数＝絵の数−1。かたまりは中心がどこにあるかで振り分ける。
   * 'auto' なら、大きなかたまりを横位置で絵の数にまとめ、そのすきまの真ん中を境目にする
   */
  boundaries: number[] | 'auto';
  /** 背景とみなす色の近さ（背景が真っ白なら小さくてよい） */
  bgTol?: number;
  /** これより小さいかたまりはごみとして捨てる（画素数） */
  minArea?: number;
  /** 中心がこれより下（高さの割合）にあるかたまりは捨てる（絵の下に勝手に付いた文字を除く） */
  maxCenterY?: number;
  /** キャラどうしのすきまなど、とじこめられた背景を消すときの色の近さ。0 なら消さない */
  enclosedTol?: number;
  size?: number;
};

/**
 * となりの絵と横にはみ出し合っている（マフラーの先と筆など）ときの切り分け。
 * 背景以外のつながったかたまりごとに、中心がどの範囲にあるかで絵に振り分ける。
 */
export async function cutByComponents(o: ComponentCutOptions) {
  const { data, info } = await sharp(o.src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const bgTol = o.bgTol ?? 14, minArea = o.minArea ?? 60, SIZE = o.size ?? 384;
  const corner = [0, 1, 2].map((c) => [data[c], data[(W - 1) * 3 + c], data[((H - 1) * W) * 3 + c], data[(N - 1) * 3 + c]].sort((a, b) => a - b)[1]);
  const dist = (k: number) => Math.hypot(data[k * 3] - corner[0], data[k * 3 + 1] - corner[1], data[k * 3 + 2] - corner[2]);

  // 外側から背景をたどる（輪郭の内側の白っぽい部分は残る）
  const alpha = new Uint8Array(N).fill(255);
  const seen = new Uint8Array(N);
  const stack: number[] = [];
  const push = (k: number) => { if (!seen[k]) { seen[k] = 1; if (dist(k) < bgTol) stack.push(k); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  const nb = (k: number) => { const x = k % W, y = (k / W) | 0; return [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]; };
  while (stack.length) { const k = stack.pop()!; alpha[k] = 0; for (const n of nb(k)) if (n >= 0) push(n); }

  // とじこめられた背景（背景色とほぼ同じ色の広い部分）も透明にする
  if (o.enclosedTol) {
    const vis = new Uint8Array(N);
    for (let k0 = 0; k0 < N; k0++) {
      if (!alpha[k0] || vis[k0] || dist(k0) >= o.enclosedTol) continue;
      const region = [k0], q = [k0];
      vis[k0] = 1;
      while (q.length) for (const n of nb(q.pop()!)) if (n >= 0 && !vis[n] && alpha[n] && dist(n) < o.enclosedTol!) { vis[n] = 1; region.push(n); q.push(n); }
      if (region.length >= 400) for (const k of region) alpha[k] = 0;
    }
  }

  // 残った部分を、つながったかたまりに分ける
  type Comp = { pix: number[]; cx: number; minX: number; maxX: number };
  const comps: Comp[] = [];
  const label = new Int32Array(N).fill(-1);
  for (let k0 = 0; k0 < N; k0++) {
    if (!alpha[k0] || label[k0] >= 0) continue;
    const pix: number[] = [k0], q = [k0];
    label[k0] = comps.length;
    let sx = 0, sy = 0, minX = W, maxX = 0;
    while (q.length) {
      const k = q.pop()!;
      const x = k % W;
      sx += x;
      sy += (k / W) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      for (const n of nb(k)) if (n >= 0 && alpha[n] && label[n] < 0) { label[n] = comps.length; q.push(n); pix.push(n); }
    }
    if (pix.length < minArea || (o.maxCenterY !== undefined && sy / pix.length / H > o.maxCenterY)) { for (const k of pix) alpha[k] = 0; label[k0] = -2; continue; }
    comps.push({ pix, cx: sx / pix.length / W, minX: minX / W, maxX: maxX / W });
  }

  // 境目を決める（auto：大きなかたまりを横位置で絵の数にまとめ、まとまりどうしのすきまの真ん中）
  let bounds: number[];
  if (o.boundaries === 'auto') {
    const total = comps.reduce((s, c) => s + c.pix.length, 0);
    const groups = comps.filter((c) => c.pix.length >= total * 0.01).sort((a, b) => a.cx - b.cx).map((c) => ({ minX: c.minX, maxX: c.maxX, cx: c.cx }));
    while (groups.length > o.outFiles.length) {
      // 横にいちばん近い（重なりが大きい・すきまが小さい）となりどうしをまとめる
      let best = 0;
      for (let i = 1; i < groups.length - 1; i++) if (groups[i + 1].minX - groups[i].maxX < groups[best + 1].minX - groups[best].maxX) best = i;
      const a = groups[best], b = groups[best + 1];
      groups.splice(best, 2, { minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), cx: (a.cx + b.cx) / 2 });
    }
    if (groups.length < o.outFiles.length) throw new Error(`${o.src}: 絵が ${groups.length} 個しか見つからない`);
    bounds = groups.slice(1).map((g, i) => (groups[i].maxX < g.minX ? (groups[i].maxX + g.minX) / 2 : (groups[i].cx + g.cx) / 2));
  } else bounds = o.boundaries;

  // 中心の横位置で振り分ける
  const group = new Int8Array(N).fill(-1);
  for (const c of comps) {
    const g = bounds.filter((b) => c.cx >= b).length;
    for (const k of c.pix) group[k] = g;
  }

  for (let g = 0; g < o.outFiles.length; g++) {
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let k = 0; k < N; k++) if (group[k] === g) {
      const x = k % W, y = (k / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const rgba = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const k = (y + minY) * W + x + minX, d = (y * bw + x) * 4;
      rgba[d] = data[k * 3]; rgba[d + 1] = data[k * 3 + 1]; rgba[d + 2] = data[k * 3 + 2];
      rgba[d + 3] = group[k] === g ? 255 : 0;
    }
    const side = Math.round(Math.max(bw, bh) * 1.1);
    const square = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: rgba, raw: { width: bw, height: bh, channels: 4 }, left: Math.round((side - bw) / 2), top: Math.round((side - bh) / 2) }])
      .png()
      .toBuffer();
    mkdirSync(dirname(o.outFiles[g]), { recursive: true });
    await sharp(square).resize(SIZE, SIZE).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(o.outFiles[g]);
    console.log(`${o.outFiles[g]}  ${bw}×${bh}`);
  }
}
