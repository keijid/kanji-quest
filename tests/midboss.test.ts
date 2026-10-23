import { describe, expect, it } from 'vitest';
import { MID_BOSSES, midBossCount, midBossSet, pendingMidBoss } from '@/lib/midboss';
import { kanjiOf } from '@/lib/data';
import { canAsk } from '@/lib/quiz';
import type { Mode, Outcome } from '@/lib/db';

const none = () => undefined;

describe('中ボス', () => {
  it('1体目は ステージ5、2体目は ステージ10 の ボスの あとに あらわれる', () => {
    const cleared = (upTo: number) => (s: number) => s <= upTo;
    expect(pendingMidBoss(cleared(4), () => false)).toBeNull();
    expect(pendingMidBoss(cleared(5), () => false)?.id).toBe(1);
    expect(pendingMidBoss(cleared(9), (id) => id === 1)).toBeNull();
    expect(pendingMidBoss(cleared(10), (id) => id === 1)?.id).toBe(2);
    // 先に すすんでいても、たおしていない 中ボスは 1体目から
    expect(pendingMidBoss(cleared(12), () => false)?.id).toBe(1);
    expect(pendingMidBoss(cleared(16), () => true)).toBeNull();
  });

  it('1体目：ステージ1〜5 から 4字ずつ 20もん、2体目：6〜10 から 3字ずつ ＋ 1〜5 から 2字ずつ 25もん', () => {
    const [m1, m2] = MID_BOSSES;
    const s1 = midBossSet(m1, none, new Set());
    expect(s1.kind).toBe('midboss');
    expect(s1.mid).toBe(1);
    expect(s1.questions).toHaveLength(midBossCount(m1));
    expect(midBossCount(m1)).toBe(20);
    for (let st = 1; st <= 5; st++) expect(s1.questions.filter((q) => kanjiOf(q.char).stage === st)).toHaveLength(4);

    const s2 = midBossSet(m2, none, new Set());
    expect(s2.questions).toHaveLength(25);
    for (let st = 6; st <= 10; st++) expect(s2.questions.filter((q) => kanjiOf(q.char).stage === st)).toHaveLength(3);
    for (let st = 1; st <= 5; st++) expect(s2.questions.filter((q) => kanjiOf(q.char).stage === st)).toHaveLength(2);
    // 同じ字は 1回だけ
    expect(new Set(s2.questions.map((q) => q.char)).size).toBe(25);
  });

  it('読み（おくりがな）→ 書き → 書きじゅん の ならびで、4わり・4わり・2わり', () => {
    const qs = midBossSet(MID_BOSSES[0], none, new Set()).questions;
    const part = (k: string) => (k === 'okuri' ? 'read' : k);
    expect(qs.map((q) => part(q.kind))).toEqual([...Array(8).fill('read'), ...Array(8).fill('write'), ...Array(4).fill('stroke')]);
    for (const q of qs) if (q.kind === 'okuri') expect(canAsk(q.char, 'okuri')).toBe(true);
  });

  it('にがての 字と、身についていない 字を 先に えらぶ', () => {
    const good: Record<Mode, Outcome[]> = { read: [2, 2], write: [2, 2], stroke: [2, 2], okuri: [] };
    // ステージ1 の 字（引・羽・雲…）：「雲」だけ にがて、ほかは よく できている
    const s = midBossSet(MID_BOSSES[0], () => good, new Set(['雲']));
    expect(s.questions.map((q) => q.char)).toContain('雲');
    // 1字も やっていない 字は、よく できている 字より 先
    const done = new Set(['引', '羽', '雲', '園', '遠', '何']);
    const s2 = midBossSet(MID_BOSSES[0], (c) => (done.has(c) ? good : undefined), new Set());
    expect(s2.questions.filter((q) => kanjiOf(q.char).stage === 1).every((q) => !done.has(q.char))).toBe(true);
  });
});
