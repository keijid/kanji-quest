// 相棒のイラスト（5段階を横に並べた1枚の絵）を、段階ごとの透過 PNG に切り分ける
// 入力: assets/partners-src/<fire|wood|light>-sheet.jpg
// 出力: public/partners/<fire|wood|light>-<1..5>.png（384×384、背景は透明）
// 使い方: npx tsx scripts/cut-partners.ts
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'assets', 'partners-src');
const OUT = join(ROOT, 'public', 'partners');
const SIZE = 384; // いちばん大きい表示が 160px（Retina で 320px）なので、これで足りる

type Sheet = {
  id: 'fire' | 'wood' | 'light';
  /** これより下は見ない（「STAGE 1」などの文字を除く）。高さに対する割合 */
  maxY: number;
  /** 背景とみなす色の近さ（RGB の距離）。光のエフェクトがある絵は大きめ */
  bgTol: number;
  /** とじこめられた背景を消すときの色の近さ。0 なら消さない（体の色が背景に近い絵） */
  enclosedTol: number;
};

const SHEETS: Sheet[] = [
  { id: 'fire', maxY: 1, bgTol: 38, enclosedTol: 12 },
  { id: 'wood', maxY: 0.8, bgTol: 38, enclosedTol: 12 },
  { id: 'light', maxY: 1, bgTol: 30, enclosedTol: 0 },
];

const DARK = 120; // 輪郭線（こげ茶）とみなす明るさ
const GROUPS = 5;

async function cut(sheet: Sheet) {
  const { data, info } = await sharp(join(SRC, `${sheet.id}-sheet.jpg`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
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
  // すきまの小さいところからつないで、5つにする
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

  mkdirSync(OUT, { recursive: true });
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
    const file = join(OUT, `${sheet.id}-${g + 1}.png`);
    // sharp は resize を composite より先に行うので、2回に分ける
    const square = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: rgba, raw: { width: bw, height: bh, channels: 4 }, left: Math.round((side - bw) / 2), top: Math.round((side - bh) / 2) }])
      .png()
      .toBuffer();
    await sharp(square).resize(SIZE, SIZE).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(file);
    console.log(`${sheet.id}-${g + 1}.png  ${bw}×${bh}`);
  }
}

(async () => { for (const s of SHEETS) await cut(s); })().catch((e) => { console.error(e); process.exit(1); });
