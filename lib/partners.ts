export type PartnerId = 'fire' | 'wood' | 'light';

export const PARTNERS: Record<PartnerId, { name: string; kind: string; elem: string; color: string; tint: string }> = {
  fire: { name: 'ホムラ', kind: 'ドラゴン', elem: 'ほのお', color: '#b8321f', tint: 'repeating-linear-gradient(45deg,#f6d6c4 0 10px,#efc6ae 10px 20px)' },
  wood: { name: 'モリー', kind: 'リス', elem: 'もり', color: '#5a8a3a', tint: 'repeating-linear-gradient(45deg,#e6f0cc 0 10px,#d8e8b4 10px 20px)' },
  light: { name: 'キララ', kind: 'ほしどり', elem: 'ひかり', color: '#c48a12', tint: 'repeating-linear-gradient(45deg,#fbeec0 0 10px,#f6e2a0 10px 20px)' },
};
export const PARTNER_IDS: PartnerId[] = ['fire', 'wood', 'light'];

/** 進化の境目（覚えた字数）。5段階 */
export const EVOLVE_AT = [0, 20, 60, 120, 180];

export function evolution(learned: number) {
  let stage = 1;
  EVOLVE_AT.forEach((t, i) => { if (learned >= t) stage = i + 1; });
  const next = EVOLVE_AT[stage] ?? 240;
  const prev = EVOLVE_AT[stage - 1];
  return {
    stage,
    /** 次の段階（最終段階なら全240字）まであと何字 */
    remaining: Math.max(0, next - learned),
    /** 今の段階の中での進み具合 0〜1 */
    ratio: Math.min(1, (learned - prev) / (next - prev)),
    final: stage === EVOLVE_AT.length,
  };
}
