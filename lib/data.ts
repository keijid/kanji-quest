import kanjiJson from '@/data/kanji.json';
import strokesJson from '@/data/strokes.json';
import type { KanjiEntry } from './kanji-types';

/** 小1・小2の240字（例文のふりがなや手書き判定の候補に使う） */
export const ALL_KANJI: KanjiEntry[] = kanjiJson as KanjiEntry[];
/** 学習の対象：小2の160字 */
export const KANJI: KanjiEntry[] = ALL_KANJI.filter((k) => k.grade === 2);
export const TOTAL = KANJI.length;
export const TARGET_SET = new Set(KANJI.map((k) => k.char));
export const STROKES: Record<string, string[]> = strokesJson as Record<string, string[]>;
const BY_CHAR = new Map(ALL_KANJI.map((k) => [k.char, k]));

export const kanjiOf = (c: string): KanjiEntry => {
  const k = BY_CHAR.get(c);
  if (!k) throw new Error(`データにない字: ${c}`);
  return k;
};

export const STAGE_COUNT = 16;
export const stageKanji = (stage: number) => KANJI.filter((k) => k.stage === stage);

// ステージ名（記法つき。ふりがなは小2までの漢字だけ）
// ステージ5 は見本どおり「どんぐりの森」
export const STAGE_NAMES = [
  'はじまりの{草:くさ}はら',
  'さらさら{小川:おがわ}',
  'ことりの{林:はやし}',
  'ぽかぽか{村:むら}',
  'どんぐりの{森:もり}',
  'にじの{谷:たに}',
  'きらきら{海:かい}がん',
  'きのこの{里:さと}',
  'ほたるの{川:かわ}べ',
  '{雲:くも}の かけはし',
  'ゆきの{山:やま}みち',
  '{星:ほし}ふる{原:はら}っぱ',
  'ほのおの{岩:いわ}やま',
  '{月:つき}の みずうみ',
  '{光:ひかり}の きゅうでん',
  '{王:おう}さまの おしろ',
];

export const kanjiReadingText = (k: KanjiEntry) => ({
  on: k.on.join('・') || '―',
  kun: k.kun.map((x) => x.stem + (x.okuri ? `(${x.okuri})` : '')).join('・') || '―',
});
