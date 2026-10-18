// 漢字データの記法を読む小さなパーサー（scripts/build-data.ts と画面の両方で使う）
//   {漢字:よみ} … ふりがな
//   [ ... ]      … 問題の対象（下線を引く部分）
//   (る)         … 対象の中のおくりがな（おくりがな問題）

export type Token =
  | { t: 'text'; s: string }
  | { t: 'ruby'; base: string; rt: string };

export type Segment = { target: boolean; tokens: Token[] };

const KANJI_RE = /[一-鿿々]/;
export const isKanji = (c: string) => KANJI_RE.test(c);
export const isHiragana = (s: string) => /^[ぁ-ゖー]+$/.test(s);
export const kataToHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** {a:b} を含む文字列を Token の並びにする */
export function parseTokens(src: string): Token[] {
  const out: Token[] = [];
  const re = /\{([^:}]+):([^}]+)\}/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index! > last) out.push({ t: 'text', s: src.slice(last, m.index) });
    out.push({ t: 'ruby', base: m[1], rt: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ t: 'text', s: src.slice(last) });
  return out;
}

/** [ ] で区切って、対象かどうかの印を付ける */
export function parseSentence(src: string): Segment[] {
  const out: Segment[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index! > last) out.push({ target: false, tokens: parseTokens(src.slice(last, m.index)) });
    out.push({ target: true, tokens: parseTokens(m[1]) });
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ target: false, tokens: parseTokens(src.slice(last)) });
  return out;
}

/** 対象部分の中身（記法そのまま） */
export function targetOf(src: string): string {
  const m = src.match(/\[([^\]]+)\]/);
  if (!m) throw new Error(`対象 [ ] がない: ${src}`);
  return m[1];
}

/** ふりがなを付けずに表示したときの文字 */
export const plain = (tokens: Token[]) => tokens.map((k) => (k.t === 'text' ? k.s : k.base)).join('');
/** ひらがなにしたときの文字（よみの答え） */
export const reading = (tokens: Token[]) => tokens.map((k) => (k.t === 'text' ? k.s : k.rt)).join('');

/** 「ひか(る)」→ { stem: 'ひか', okuri: 'る' } */
export function splitOkuri(kun: string): { stem: string; okuri: string } {
  const m = kun.match(/^([^()]+)(?:\(([^)]+)\))?$/);
  if (!m) throw new Error(`訓読みの形がおかしい: ${kun}`);
  return { stem: m[1], okuri: m[2] ?? '' };
}
