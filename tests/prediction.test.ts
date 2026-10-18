import { describe, expect, it } from 'vitest';
import { kanjiMastery, passPrediction } from '@/lib/progress';
import { KANJI, TARGET_SET } from '@/lib/data';
import type { Outcome } from '@/lib/db';

const hist = (read: Outcome[] = [], write: Outcome[] = [], stroke: Outcome[] = [], okuri: Outcome[] = []) => ({ read, write, stroke, okuri });

describe('合格予想', () => {
  it('まだ何もしていなければ 0%', () => {
    expect(passPrediction([], TARGET_SET, undefined)).toBe(0);
  });

  it('1字だけ全部正解しても 1% くらい（160字のうち1字）', () => {
    const p = passPrediction([{ char: KANJI[0].char, hist: hist([2, 2], [2], [2], [2]) }], TARGET_SET, undefined);
    expect(p).toBe(1);
  });

  it('160字すべて しっかり正解していれば 100%', () => {
    const all = KANJI.map((k) => ({ char: k.char, hist: hist([2, 2], [2, 2], [2]) }));
    expect(passPrediction(all, TARGET_SET, undefined)).toBe(100);
  });

  it('1問ずつ正解しただけでは割り引く（3問で満点）', () => {
    expect(kanjiMastery(hist([2]))).toBeCloseTo(1 / 3);
    expect(kanjiMastery(hist([2], [2], [2]))).toBe(1);
    expect(kanjiMastery(hist([0], [2], [1]))).toBeCloseTo((0 + 1 + 0.6) / 3);
  });

  it('小1の字（学習の対象外）は数えない', () => {
    const notTarget = '一';
    expect(TARGET_SET.has(notTarget)).toBe(false);
    expect(passPrediction([{ char: notTarget, hist: hist([2, 2], [2, 2]) }], TARGET_SET, undefined)).toBe(0);
  });

  it('もぎテスト（ほんばん）の最高点を半分まぜる', () => {
    const p = passPrediction([], TARGET_SET, { kind: 'full', score: 120, max: 150, byField: {}, at: 0 });
    expect(p).toBe(40);
  });
});
