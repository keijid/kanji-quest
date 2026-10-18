import kanjiJson from '@/data/kanji.json';
import strokesJson from '@/data/strokes.json';
import type { KanjiEntry } from './kanji-types';

export const KANJI: KanjiEntry[] = kanjiJson as KanjiEntry[];
export const STROKES: Record<string, string[]> = strokesJson as Record<string, string[]>;
const BY_CHAR = new Map(KANJI.map((k) => [k.char, k]));

export const kanjiOf = (c: string): KanjiEntry => {
  const k = BY_CHAR.get(c);
  if (!k) throw new Error(`240字にない: ${c}`);
  return k;
};

export const STAGE_COUNT = 24;
export const stageKanji = (stage: number) => KANJI.filter((k) => k.stage === stage);
export const G1_COUNT = 80;
export const G2_COUNT = 160;

// ステージ名（記法つき。ふりがなは小2までの漢字だけ）
export const STAGE_NAMES = [
  'はじまりの{草:くさ}はら',
  'ひだまりの{野:の}はら',
  'さらさら{小川:おがわ}',
  'ことりの{林:はやし}',
  'ぽかぽか{村:むら}',
  'にじの{谷:たに}',
  'はなさく{花:はな}ばたけ',
  '{大岩:おおいわ}の とりで',
  '{風:かぜ}の みち',
  'きらきら{海:かい}がん',
  'さかなの{池:いけ}',
  'きのこの{里:さと}',
  'どんぐりの{森:もり}',
  'ほたるの{川:かわ}べ',
  '{雲:くも}の かけはし',
  'こおりの{門:もん}',
  'ゆきの{山:やま}みち',
  '{星:ほし}ふる{原:はら}っぱ',
  '{古:ふる}い お{寺:てら}',
  'ほのおの{岩:いわ}やま',
  '{月:つき}の みずうみ',
  'まぼろしの{市:いち}',
  '{光:ひかり}の きゅうでん',
  '{王:おう}さまの おしろ',
];

export const kanjiReadingText = (k: KanjiEntry) => ({
  on: k.on.join('・') || '―',
  kun: k.kun.map((x) => x.stem + (x.okuri ? `(${x.okuri})` : '')).join('・') || '―',
});
