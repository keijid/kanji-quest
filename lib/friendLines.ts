// なかま（主人公の 勇者・相棒）の せりふ（記法つき）と 声。ずかんの「なかま」で 絵を おすと しゃべる
// 声は public/voice/（scripts/gen-voices.ts で 作る）。相棒は いまは ホムラだけ 鳴き声が ある
import type { PartnerId } from './partners';

/** 勇者の せりふ。称号の 段階 1〜6（lib/progress.ts の TITLES）ごと。相棒は えらんだ 子に よって ちがうので 名前は 言わない */
export const HERO_LINES = [
  'ぼくは かけだし ゆうしゃ！ かん{字:じ}の たびに しゅっぱつだ！',
  'りゅうの みならいに なったぞ！ あいぼうが いれば こわくない！',
  'りゅうの けんし、さんじょう！ かん{字:じ}の けんで まけないぞ！',
  'ドラゴン ナイトだ！ どんな ボスでも かかってこい！',
  'ほのおの まけんしの ちから、{見:み}せて やる！',
  'でんせつの ドラゴンゆうしゃ！ 160{字:じ} ぜんぶ ぼくの なかまだ！',
];

/** ホムラの 鳴き声。しんかの 段階 1〜5 ごと（たまご → 大きな ドラゴン） */
export const HOMURA_CRIES = ['ピィ！ ピィピィ！', 'キューッ！ キュッキュー！', 'ギャウッ！ ギャオーッ！', 'ガオオーッ！', 'グオオオーッ！'];

/** 声の ファイル名（public/voice/）。勇者：hero-<段階>、相棒：partner-<相棒>-<段階>（鳴き声が ない 相棒は なし） */
export const heroVoice = (rank: number) => `hero-${rank}`;
export const partnerVoice = (id: PartnerId, stage: number) => (id === 'fire' ? `partner-fire-${stage}` : undefined);
