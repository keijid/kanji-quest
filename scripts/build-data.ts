// data/kanji-source.txt を読み、チェックしてから data/kanji.json を書き出す。
// 使い方: npx tsx scripts/build-data.ts   （--table で一覧表 data/kanji-table.md も出す）
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { G1, G2, KANJI_SET } from '../data/kanji-list';
import { isHiragana, isKanji, kataToHira, parseSentence, parseTokens, plain, reading, splitOkuri, targetOf, type Token } from '../lib/markup';
import type { KanjiEntry } from '../lib/kanji-types';

const ROOT = join(__dirname, '..');
const strokes: Record<string, string[]> = JSON.parse(readFileSync(join(ROOT, 'data/strokes.json'), 'utf8'));
const lines = readFileSync(join(ROOT, 'data/kanji-source.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

const errors: string[] = [];
const warnings: string[] = [];
const err = (c: string, m: string) => errors.push(`${c}: ${m}`);
const warn = (c: string, m: string) => warnings.push(`${c}: ${m}`);

// 熟字訓などで、1字のよみとしては読み方の表にないが正しいもの
const SPECIAL_READINGS: Record<string, string[]> = { 父: ['とう'], 母: ['かあ'], 兄: ['にい'], 姉: ['ねえ'], 七: ['しち'], 時: ['じ', 'と'] };

const VOICED: Record<string, string> = Object.fromEntries(
  [...'かきくけこさしすせそたちつてとはひふへほ'].map((c) => [c, String.fromCharCode(c.charCodeAt(0) + 1)]),
);
const HANDAKU: Record<string, string> = Object.fromEntries([...'はひふへほ'].map((c) => [c, String.fromCharCode(c.charCodeAt(0) + 2)]));

const entries = new Map<string, KanjiEntry>();
const readingsOf = (e: KanjiEntry) => {
  const base = [...e.on.map(kataToHira), ...e.kun.map((k) => k.stem), ...e.kun.map((k) => k.stem + k.okuri), ...(SPECIAL_READINGS[e.char] ?? [])];
  const out = new Set<string>();
  for (const r of base) {
    out.add(r);
    out.add(r.slice(0, -1) + 'っ'); // がく→がっ
    const f = r[0];
    if (VOICED[f]) out.add(VOICED[f] + r.slice(1)); // かわ→がわ
    if (HANDAKU[f]) out.add(HANDAKU[f] + r.slice(1)); // ひょう→ぴょう
    if (VOICED[f]) out.add(VOICED[f] + r.slice(1, -1) + 'っ');
  }
  return out;
};

/** 文中のすべての漢字が 240字に入っていて、ふりがなが付いているか */
function checkText(c: string, label: string, tokens: Token[], needRuby = true) {
  for (const k of tokens) {
    if (k.t === 'text') {
      for (const ch of k.s) {
        if (isKanji(ch)) {
          if (!KANJI_SET.has(ch)) err(c, `${label}: 小2までに習わない漢字「${ch}」`);
          else if (needRuby) err(c, `${label}: 「${ch}」にふりがながない`);
        }
      }
    } else {
      if (!isHiragana(k.rt)) err(c, `${label}: ふりがな「${k.rt}」がひらがなでない`);
      for (const ch of k.base) {
        if (!isKanji(ch)) err(c, `${label}: ふりがなの親文字に漢字以外「${ch}」`);
        else if (!KANJI_SET.has(ch)) err(c, `${label}: 小2までに習わない漢字「${ch}」`);
      }
    }
  }
}

function checkRubyReadings(label: string, tokens: Token[]) {
  for (const k of tokens) {
    if (k.t !== 'ruby' || [...k.base].length !== 1) continue;
    const e = entries.get(k.base);
    if (e && !readingsOf(e).has(k.rt)) warn(k.base, `${label}: 「${k.base}」を「${k.rt}」と読ませている（読み方の表にない）`);
  }
}

lines.forEach((line, i) => {
  const f = line.split(' | ').map((s) => s.trim());
  const c = f[0];
  if (f.length !== 9) return err(c ?? `行${i}`, `列の数が ${f.length}（9 のはず）`);
  const [, strokeStr, radical, onStr, kunStr, wordStr, readStr, writeStr, okuriStr] = f;
  const g1 = G1.indexOf(c), g2 = G2.indexOf(c);
  if (g1 < 0 && g2 < 0) return err(c, '240字の一覧にない');
  const stage = g1 >= 0 ? Math.floor(g1 / 10) + 1 : Math.floor(g2 / 10) + 9;
  const e: KanjiEntry = {
    char: c,
    grade: g1 >= 0 ? 1 : 2,
    stage,
    strokes: Number(strokeStr),
    radical,
    on: onStr === '-' ? [] : onStr.split('・'),
    kun: kunStr === '-' ? [] : kunStr.split('・').map(splitOkuri),
    words: wordStr.split('・'),
    questions: {
      read: readStr.split(' ; ').map((s) => s.trim()),
      write: writeStr === '-' ? [] : writeStr.split(' ; ').map((s) => s.trim()),
      okuri: okuriStr === '-' ? [] : okuriStr.split(' ; ').map((s) => s.trim()),
    },
  };
  if (entries.has(c)) err(c, '2回出てくる');
  entries.set(c, e);
});

for (const e of entries.values()) {
  const c = e.char;
  const kvg = strokes[c]?.length;
  if (!kvg) err(c, 'KanjiVG のデータがない');
  else if (kvg !== e.strokes) err(c, `画数 ${e.strokes} が KanjiVG（${kvg}画）と合わない`);
  if (!e.on.every((s) => /^[ァ-ヶ]+$/.test(s))) err(c, `音読みがカタカナでない: ${e.on}`);
  if (!e.kun.every((k) => isHiragana(k.stem) && (!k.okuri || isHiragana(k.okuri)))) err(c, '訓読みがひらがなでない');

  e.words.forEach((w) => {
    const t = parseTokens(w);
    checkText(c, `ことば「${w}」`, t);
    checkRubyReadings(`ことば「${w}」`, t);
    if (!plain(t).includes(c)) err(c, `ことば「${w}」にこの字が入っていない`);
  });

  if (!e.questions.read.length) err(c, 'よみ問題がない');
  e.questions.read.forEach((q) => {
    const segs = parseSentence(q);
    segs.forEach((s) => { checkText(c, `よみ「${q}」`, s.tokens, !s.target); checkRubyReadings(`よみ「${q}」`, s.tokens); });
    const tg = segs.filter((s) => s.target);
    if (tg.length !== 1) return err(c, `よみ「${q}」: 対象 [ ] がちょうど1つでない`);
    const tt = tg[0].tokens;
    if (tt.some((k) => k.t === 'text')) err(c, `よみ「${q}」: 対象の中は漢字（ふりがな付き）だけにする`);
    if (!plain(tt).includes(c)) err(c, `よみ「${q}」: 対象にこの字が入っていない`);
    const ans = reading(tt);
    if (!isHiragana(ans)) err(c, `よみ「${q}」: 答え「${ans}」がひらがなでない`);
    if (ans.length > 6) warn(c, `よみ「${q}」: 答えが ${ans.length} 文字（マスが多い）`);
  });

  if (!e.questions.write.length) err(c, 'かき問題がない');
  e.questions.write.forEach((q) => {
    const segs = parseSentence(q);
    segs.forEach((s) => { checkText(c, `かき「${q}」`, s.tokens); checkRubyReadings(`かき「${q}」`, s.tokens); });
    const tg = targetOf(q);
    if (!isHiragana(tg)) err(c, `かき「${q}」: 対象「${tg}」がひらがなでない`);
    if (plain(segs.flatMap((s) => s.tokens)).includes(c)) err(c, `かき「${q}」: 答えの字が文の中に出ている`);
  });

  e.questions.okuri.forEach((q) => {
    const segs = parseSentence(q.replace(/[()]/g, (m) => (m === '(' ? '（' : '）')));
    segs.forEach((s) => { if (!s.target) { checkText(c, `おくりがな「${q}」`, s.tokens); checkRubyReadings(`おくりがな「${q}」`, s.tokens); } });
    const tg = targetOf(q);
    const { stem, okuri } = splitOkuri(tg);
    if (!okuri) err(c, `おくりがな「${q}」: おくりがな ( ) がない`);
    if (!e.kun.some((k) => k.stem === stem && k.okuri === okuri)) err(c, `おくりがな「${q}」: 「${tg}」が訓読みの表にない`);
  });
  if (!e.questions.okuri.length && e.kun.some((k) => k.okuri)) warn(c, 'おくりがなのある訓読みがあるのに、おくりがな問題がない');
}

const order = [...G1, ...G2];
for (const c of order) if (!entries.has(c)) err(c, 'データがない');

if (warnings.length) console.warn(`注意 ${warnings.length} 件\n  ` + warnings.join('\n  '));
if (errors.length) {
  console.error(`エラー ${errors.length} 件\n  ` + errors.join('\n  '));
  process.exit(1);
}

const list = order.map((c) => entries.get(c)!);
writeFileSync(join(ROOT, 'data/kanji.json'), JSON.stringify(list));
console.log(`OK: ${list.length} 字を data/kanji.json に書き出しました`);

if (process.argv.includes('--table')) {
  const fmt = (s: string) => s.replace(/\{([^:}]+):([^}]+)\}/g, '$1（$2）');
  const rows = list.map((e) =>
    `| ${e.stage} | ${e.char} | ${e.strokes} | ${e.radical} | ${e.on.join('・') || '―'} | ${e.kun.map((k) => k.stem + (k.okuri ? `(${k.okuri})` : '')).join('・') || '―'} | ${e.words.map(fmt).join('・')} | ${e.questions.read.map(fmt).join('<br>')} | ${e.questions.write.map(fmt).join('<br>')} | ${e.questions.okuri.map(fmt).join('<br>') || '―'} |`,
  );
  writeFileSync(
    join(ROOT, 'data/kanji-table.md'),
    `# 240字 データ一覧（自動生成：scripts/build-data.ts --table）\n\n[ ] が問題の対象、（ ）がふりがな。\n\n| ステージ | 字 | 画数 | 部首 | 音 | 訓 | ことば | よみ問題 | かき問題 | おくりがな問題 |\n|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`,
  );
  console.log('data/kanji-table.md を書き出しました');
}
