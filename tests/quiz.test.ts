import { describe, expect, it } from 'vitest';
import { canAsk, bossSet, lessonSet } from '@/lib/quiz';
import { bossUnlocked, starsFor } from '@/lib/progress';
import { stageKanji, STAGE_COUNT } from '@/lib/data';

describe('1字ずつの練習', () => {
  it('その字だけを、よみ → おくりがな（ある字だけ）→ かき → かきじゅん の順に出す', () => {
    for (const c of ['光', '雲']) {
      const s = lessonSet(c);
      expect(s.kind).toBe('lesson');
      expect(s.char).toBe(c);
      expect(s.questions.every((q) => q.char === c)).toBe(true);
      const kinds = s.questions.map((q) => q.kind);
      const order = ['read', 'okuri', 'write', 'stroke'];
      expect([...kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(kinds);
      expect(kinds.includes('okuri')).toBe(canAsk(c, 'okuri'));
      expect(kinds.filter((k) => k === 'write')).toHaveLength(1);
      expect(kinds.filter((k) => k === 'stroke')).toHaveLength(1);
    }
  });

  it('よみは ちがう文で2問まで', () => {
    const s = lessonSet('光');
    const reads = s.questions.filter((q) => q.kind === 'read');
    expect(reads.length).toBeLessThanOrEqual(2);
    expect(new Set(reads.map((q) => (q.kind === 'read' ? q.sentence : ''))).size).toBe(reads.length);
  });
});

describe('ボスせん', () => {
  it('ステージの10字すべてを、よみ（おくりがなをまぜる）・かき・かきじゅん で1問ずつ、計30問', () => {
    for (let st = 1; st <= STAGE_COUNT; st++) {
      const chars = stageKanji(st).map((k) => k.char);
      const qs = bossSet(st).questions;
      expect(qs).toHaveLength(30);
      for (const c of chars) {
        const mine = qs.filter((q) => q.char === c).map((q) => q.kind);
        expect(mine.filter((k) => k === 'read' || k === 'okuri')).toHaveLength(1);
        if (!canAsk(c, 'okuri')) expect(mine).not.toContain('okuri');
        expect(mine.filter((k) => k === 'write')).toHaveLength(1);
        expect(mine.filter((k) => k === 'stroke')).toHaveLength(1);
      }
      // よみ（おくりがなを含む）→ かき → かきじゅん の順
      const part = (k: string) => (k === 'read' || k === 'okuri' ? 0 : k === 'write' ? 1 : 2);
      const parts = qs.map((q) => part(q.kind));
      expect([...parts].sort()).toEqual(parts);
    }
  });

  it('10字すべて練習ずみになるまで ちょうせん できない', () => {
    const chars = stageKanji(1).map((k) => k.char);
    expect(bossUnlocked(1, new Set(chars.slice(0, 9)))).toBe(false);
    expect(bossUnlocked(1, new Set(chars))).toBe(true);
  });
});

describe('星', () => {
  it('ぜんぶ 正解で 3つ、1問 まちがい なら 少ない 問題数でも 2つ', () => {
    expect(starsFor(4, 4)).toBe(3);
    expect(starsFor(3, 4)).toBe(2);
    expect(starsFor(2, 3)).toBe(2);
    expect(starsFor(8, 10)).toBe(2);
    expect(starsFor(7, 10)).toBe(1);
    expect(starsFor(2, 4)).toBe(1);
    expect(starsFor(0, 1)).toBe(0);
  });
});
