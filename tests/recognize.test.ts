import { describe, expect, it } from 'vitest';
import { KANA_POOL, KANJI_POOL, judge, judgeCopy, judgeKana, judgeKanji } from '@/lib/recognize';
import { fakeHand, rng } from './fake-hand';

// 子どもが書いたような線（ゆがみ・書き順ちがい・つづけ書き）で、合格率と誤合格率を確かめる
function rates(pool: readonly string[], mess: number, every = 4) {
  let ok = 0, n = 0, wrong = 0, wn = 0;
  pool.forEach((c, i) => {
    if (i % every) return;
    const hand = fakeHand(c, i * 17 + 3, { mess, shuffle: true, joinProb: 0.15 });
    n++;
    if (judge(hand, c, pool).ok) ok++;
    const other = pool[(i * 7 + 5) % pool.length];
    if (other !== c) { wn++; if (judge(hand, other, pool).ok) wrong++; }
  });
  return { ok: ok / n, wrong: wrong / wn };
}

describe('手書き判定', () => {
  it('漢字：ふつうのくずれなら ほぼ合格、ちがう字はほぼ不合格', () => {
    const r = rates(KANJI_POOL, 1);
    expect(r.ok).toBeGreaterThanOrEqual(0.9);
    expect(r.wrong).toBeLessThanOrEqual(0.03);
  });

  it('ひらがな：ふつうのくずれなら ほぼ合格、ちがう字はほぼ不合格', () => {
    const r = rates(KANA_POOL, 1, 1);
    expect(r.ok).toBeGreaterThanOrEqual(0.95);
    expect(r.wrong).toBeLessThanOrEqual(0.03);
  });

  it('書き順・画の向きを変えても判定は同じ', () => {
    const a = fakeHand('光', 1, { mess: 0.5 });
    const b = fakeHand('光', 1, { mess: 0.5, shuffle: true });
    expect(judgeKanji(a, '光').ok).toBe(true);
    expect(judgeKanji(b, '光').ok).toBe(true);
  });

  it('何も書いていなければ不合格', () => {
    expect(judgeKanji([], '光').ok).toBe(false);
  });

  it('でたらめな線は不合格', () => {
    const r = rng(42);
    let passed = 0;
    for (let t = 0; t < 20; t++) {
      const strokes = Array.from({ length: 1 + Math.floor(r() * 5) }, () =>
        Array.from({ length: 12 }, () => ({ x: r() * 300, y: r() * 300 })));
      if (judgeKanji(strokes, KANJI_POOL[t * 11]).ok) passed++;
    }
    expect(passed).toBeLessThanOrEqual(1);
  });

  it('小さい字（ょ）は大きい字（よ）と同じ形として認める', () => {
    expect(judgeKana(fakeHand('よ', 3, { mess: 0.5 }), 'ょ').ok).toBe(true);
  });

  it('画数がぴったり合う、にた字のほうが近ければ不合格（二 と 三）', () => {
    expect(judgeKanji(fakeHand('二', 5, { mess: 0.3 }), '三').ok).toBe(false);
  });
});

describe('5回れんしゅう の判定', () => {
  it('ふつうに写した字は できた', () => {
    let ok = 0, n = 0;
    KANJI_POOL.forEach((c, i) => {
      if (i % 4) return;
      n++;
      if (judgeCopy(fakeHand(c, i * 13 + 1, { mess: 1, shuffle: true, joinProb: 0.15 }), c)) ok++;
    });
    expect(ok / n).toBeGreaterThanOrEqual(0.85);
  });

  it('お手本の 画が 1本 ぬけた字は できた に しない（「家」の 一 が ない など）', () => {
    let passed = 0, n = 0;
    KANJI_POOL.forEach((c, i) => {
      const hand = fakeHand(c, i * 13 + 2, { mess: 0.6 });
      if (i % 4 || hand.length < 4) return;
      n++;
      if (judgeCopy(hand.filter((_, j) => j !== (i * 7) % hand.length), c)) passed++;
    });
    expect(passed / n).toBeLessThanOrEqual(0.05);
  });

  it('画が 大きく足りない字は できた に しない', () => {
    for (const c of ['雲', '曜', '親', '顔']) {
      const hand = fakeHand(c, 7, { mess: 0.5 });
      expect(judgeCopy(hand.slice(0, Math.floor(hand.length / 2)), c)).toBe(false);
    }
  });
});
