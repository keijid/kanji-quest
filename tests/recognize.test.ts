import { describe, expect, it } from 'vitest';
import { KANA_POOL, KANJI_POOL, checkCopy, judge, judgeCopy, judgeKana, judgeKanji } from '@/lib/recognize';
import { fakeHand, rng } from './fake-hand';
import type { Pt } from '@/lib/recognize/svgPath';

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

  it('小さい字は ゆるめに 見るが、ちがう字は 小さい字として 認めない', () => {
    for (const c of ['ま', 'は', 'ほ', 'お', 'す', 'ふ']) {
      for (let s = 1; s <= 5; s++) expect(judgeKana(fakeHand(c, s, { mess: 0.8, shuffle: true }), 'ょ').ok).toBe(false);
    }
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
    // くずれた字を 通しやすく するため 少し ゆるめてある（大きく くずれた字の 合格を 優先し、ぬけは 2わりちょっと まで ゆるす）
    expect(passed / n).toBeLessThanOrEqual(0.25);
  });

  it('「遠」の しんにょう など、画を つなげて 書いても できた に なる', () => {
    let ok = 0;
    for (let seed = 0; seed < 20; seed++) if (judgeCopy(fakeHand('遠', seed * 17 + 3, { mess: 1.3, shuffle: true, joinProb: 0.15 }), '遠')) ok++;
    expect(ok / 20).toBeGreaterThanOrEqual(0.8);
  });

  // 実機で 書いた「語」（写真から 線を おこしたもの。700×700 の マス）
  /** 点を つないだ 線（1区間 10点） */
  const L = (...p: number[][]) => {
    const out: Pt[] = [];
    for (let i = 1; i < p.length; i++) for (let t = 0; t < 10; t++) out.push({ x: p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t / 10, y: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t / 10 });
    out.push({ x: p[p.length - 1][0], y: p[p.length - 1][1] });
    return out;
  };
  /** 1回目（そのまま できた） */
  const pad1 = [L([145,120],[175,110],[205,170]),L([55,265],[270,275]),L([120,350],[240,348]),L([140,450],[245,452]),L([110,535],[105,650]),L([110,535],[235,510],[200,635]),L([90,660],[240,630]),
    L([390,140],[615,148]),L([470,135],[425,320]),L([390,215],[540,210],[505,340]),L([370,330],[630,350]),L([400,455],[410,600]),L([400,455],[550,445],[520,590]),L([410,600],[560,590])];
  /** 3回目（五 が へんより 下に 書いてあり、五の 一 が「ない」に なっていた） */
  const pad3 = [L([185,105],[240,195]),L([90,285],[315,235]),L([170,360],[280,345]),L([160,465],[270,452]),L([95,545],[120,655]),L([95,545],[270,505],[215,655]),L([145,640],[240,655]),
    L([425,178],[590,170]),L([495,185],[455,330]),L([390,262],[560,228],[545,340]),L([375,350],[610,340]),L([390,425],[400,575]),L([400,430],[550,425],[520,550]),L([400,575],[545,555])];
  const lower = (h: Pt[][], dy: number) => h.map((s, j) => (j >= 7 ? s.map((p) => ({ x: p.x, y: p.y + dy })) : s));

  it('へんと つくりの 高さが ずれていても、画が そろっていれば できた（「語」）', () => {
    expect(checkCopy(pad1, '語')).toEqual({ ok: true, missing: [] });
    for (const dy of [0, 15, 30]) expect(checkCopy(lower(pad3, dy), '語'), `dy=${dy}`).toEqual({ ok: true, missing: [] });
  });

  it('ずれを 合わせても、ぬけた画は ぬけた まま（「語」の 五 の 一）', () => {
    const r = checkCopy(lower(pad3, 15).filter((_, j) => j !== 7), '語');
    expect(r.ok).toBe(false);
    expect(r.missing).toContain(7);
  });

  // 実機で 書いた「高」（口の 中に ななめ線、上に 短い線が よけいに ある 12画）
  const ko = [L([365,90],[350,185]),L([160,190],[195,185]),L([125,225],[350,200],[530,195]),L([205,255],[195,380]),L([205,250],[410,240],[360,355]),L([200,375],[340,352]),
    L([115,415],[145,580]),L([140,425],[470,385],[495,430],[480,650]),L([225,485],[240,590]),L([230,490],[370,470],[380,575]),L([225,580],[370,570]),L([310,535],[350,490])];

  it('よけいな 線が ある字は できた に しない（「高」）', () => {
    expect(checkCopy(ko, '高')).toMatchObject({ ok: false, reason: 'many' });
    // よけいな 線を 2本 とれば できた
    expect(checkCopy(ko.filter((_, j) => j !== 1 && j !== 11), '高').ok).toBe(true);
    // 折れを 2本に 分けて 書いた 1画ぶんは ゆるす
    expect(checkCopy(ko.filter((_, j) => j !== 1), '高').ok).toBe(true);
  });

  it('画が 大きく足りない字は できた に しない', () => {
    for (const c of ['雲', '曜', '親', '顔']) {
      const hand = fakeHand(c, 7, { mess: 0.5 });
      expect(judgeCopy(hand.slice(0, Math.floor(hand.length / 2)), c)).toBe(false);
    }
  });
});
