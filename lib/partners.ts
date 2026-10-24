import { TOTAL } from './data';

export type PartnerId = 'fire' | 'wood' | 'light';

/** name は 相棒の 名前、forms は しんかの 段階 1〜5 ごとの すがたの 名前 */
export const PARTNERS: Record<PartnerId, { name: string; kind: string; elem: string; color: string; tint: string; forms: string[] }> = {
  fire: { name: 'ホムラ', kind: 'ドラゴン', elem: 'ほのお', color: '#b8321f', tint: 'repeating-linear-gradient(45deg,#f6d6c4 0 10px,#efc6ae 10px 20px)',
    forms: ['ヒノコドラ', 'フレアドラ', 'バーンドラゴン', 'ブレイズドラゴン', 'インフェルノカイザー'] },
  wood: { name: 'モリー', kind: 'リス', elem: 'もり', color: '#5a8a3a', tint: 'repeating-linear-gradient(45deg,#e6f0cc 0 10px,#d8e8b4 10px 20px)',
    forms: ['ドングリス', 'コノミリス', 'リーフリス', 'フォレストガーディアン', 'ユグドラリス'] },
  light: { name: 'キララ', kind: 'ほしどり', elem: 'ひかり', color: '#c48a12', tint: 'repeating-linear-gradient(45deg,#fbeec0 0 10px,#f6e2a0 10px 20px)',
    forms: ['ホシタマ', 'ピヨスター', 'スターウイング', 'コメットバード', 'ギャラクシーフェニックス'] },
};
/** しんかの 段階の すがたの 名前 */
export const formName = (id: PartnerId, stage: number) => PARTNERS[id].forms[stage - 1] ?? PARTNERS[id].name;
export const PARTNER_IDS: PartnerId[] = ['fire', 'wood', 'light'];

/** 進化の境目（練習ずみの字数＝地図の★の数）。5段階。最後は全160字 */
export const EVOLVE_AT = [0, 15, 40, 80, 120];

export function evolution(practiced: number) {
  let stage = 1;
  EVOLVE_AT.forEach((t, i) => { if (practiced >= t) stage = i + 1; });
  const next = EVOLVE_AT[stage] ?? TOTAL;
  const prev = EVOLVE_AT[stage - 1];
  return {
    stage,
    /** 次の段階（最終段階なら全160字）まであと何字 */
    remaining: Math.max(0, next - practiced),
    /** 今の段階の中での進み具合 0〜1 */
    ratio: Math.min(1, (practiced - prev) / (next - prev)),
    final: stage === EVOLVE_AT.length,
  };
}
