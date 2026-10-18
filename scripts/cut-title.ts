// タイトル文字「カンジクエスト」（Gemini で作った assets/title-src.jpg、白い背景）を透過 PNG にする
// 出力: public/title.png（高さ 240px。表示はいちばん大きい「はじめて」画面で高さ 96px → Retina で 192px）
// 使い方: npm run title
import sharp from 'sharp';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'assets', 'title-src.jpg');
const OUT = join(ROOT, 'public', 'title.png');
const HEIGHT = 240;
const BG_TOL = 40; // 外側からたどる背景の色の近さ
const ENCLOSED_TOL = 14; // 文字のすきまに閉じこめられた白（文字のクリーム色とは 40 ほどちがう）
const ENCLOSED_MIN = 60;

async function main() {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const dist = (k: number) => Math.hypot(255 - data[k * 3], 255 - data[k * 3 + 1], 255 - data[k * 3 + 2]);
  const alpha = new Uint8Array(N).fill(255);

  // 外側から、白に近い色をたどって透明にする
  const seen = new Uint8Array(N);
  const stack: number[] = [];
  const push = (k: number) => { if (!seen[k]) { seen[k] = 1; if (dist(k) < BG_TOL) stack.push(k); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  const neighbors = (k: number) => {
    const x = k % W, y = (k / W) | 0;
    return [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1];
  };
  while (stack.length) {
    const k = stack.pop()!;
    alpha[k] = 0;
    for (const n of neighbors(k)) if (n >= 0) push(n);
  }

  // 文字と文字の間などに閉じこめられた真っ白な部分も透明にする
  const vis = new Uint8Array(N);
  for (let k0 = 0; k0 < N; k0++) {
    if (!alpha[k0] || vis[k0] || dist(k0) >= ENCLOSED_TOL) continue;
    const region = [k0], q = [k0];
    vis[k0] = 1;
    while (q.length) {
      for (const n of neighbors(q.pop()!)) {
        if (n < 0 || vis[n] || !alpha[n] || dist(n) >= ENCLOSED_TOL) continue;
        vis[n] = 1; region.push(n); q.push(n);
      }
    }
    if (region.length >= ENCLOSED_MIN) for (const k of region) alpha[k] = 0;
  }

  const rgba = Buffer.alloc(N * 4);
  for (let k = 0; k < N; k++) {
    rgba[k * 4] = data[k * 3]; rgba[k * 4 + 1] = data[k * 3 + 1]; rgba[k * 4 + 2] = data[k * 3 + 2];
    rgba[k * 4 + 3] = alpha[k];
  }
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .trim({ threshold: 0 })
    .resize({ height: HEIGHT })
    .png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 })
    .toFile(OUT);
  const m = await sharp(OUT).metadata();
  console.log(`title.png ${m.width}×${m.height}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
