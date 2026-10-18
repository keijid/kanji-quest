// KanjiVG（https://github.com/KanjiVG/kanjivg, CC BY-SA 3.0）から、240字とひらがなの SVG を取り込み、
// 画ごとのパスを data/strokes.json 1ファイルにまとめる。
// 使い方: npx tsx scripts/fetch-kanjivg.ts
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_KANJI } from '../data/kanji-list';

// 取り込むコミット（再現できるように固定する）
const REF = process.env.KANJIVG_REF ?? '70a0b7ae0c18ceb5cb358274b029cce0234a43bc';
const RAW = `https://raw.githubusercontent.com/KanjiVG/kanjivg/${REF}/kanji`;
const CACHE = join(__dirname, '..', 'data', 'kanjivg-src');

// ひらがな（ぁ〜ゖ のうち、よみ・おくりがなで使うもの）
const HIRAGANA = [...'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわをんー'];

const hex = (c: string) => c.codePointAt(0)!.toString(16).padStart(5, '0');

async function fetchSvg(c: string): Promise<string> {
  const file = join(CACHE, `${hex(c)}.svg`);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const res = await fetch(`${RAW}/${hex(c)}.svg`);
  if (!res.ok) throw new Error(`${c} (${hex(c)}): HTTP ${res.status}`);
  const svg = await res.text();
  writeFileSync(file, svg);
  return svg;
}

function strokePaths(svg: string): string[] {
  // 画のパスは id="kvg:XXXXX-sN" の path 要素。出てくる順が書き順。
  return [...svg.matchAll(/<path[^>]*\bid="kvg:[0-9a-f]+-s\d+"[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const out: Record<string, string[]> = {};
  const chars = [...ALL_KANJI, ...HIRAGANA];
  for (let i = 0; i < chars.length; i += 16) {
    const batch = chars.slice(i, i + 16);
    const svgs = await Promise.all(batch.map(fetchSvg));
    batch.forEach((c, j) => {
      const paths = strokePaths(svgs[j]);
      if (!paths.length) throw new Error(`${c}: 画のパスが見つからない`);
      out[c] = paths;
    });
  }
  writeFileSync(join(__dirname, '..', 'data', 'strokes.json'), JSON.stringify(out));
  console.log(`${Object.keys(out).length} 字を書き出しました（KanjiVG ${REF}）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
