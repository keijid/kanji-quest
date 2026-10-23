// 中ボス：ステージを いくつか 進むと、地図で 字を えらんだ ときに いきなり あらわれる ふくしゅうテスト。
// 前に やった字を わすれないように、ここまでの ステージの 字から 出す（にがて・身についていない 字を 先に えらぶ）
import { kanjiMastery } from './progress';
import { stageKanji } from './data';
import { canAsk, makeQuestion, shuffle, type Question, type QuizSet } from './quiz';
import type { Mode, Outcome } from './db';

export type MidBoss = {
  id: number;
  /** この ステージの ボスを たおすと、つぎの ステージの 字を えらんだ ときに あらわれる */
  after: number;
  /** 出す ステージと、ステージごとの 字の 数（足すと 問題の 数） */
  pick: { stages: number[]; per: number }[];
  name: string;
  /** あらわれた ときの せりふ（記法つき） */
  line: string;
};

export const MID_BOSSES: MidBoss[] = [
  {
    id: 1, after: 5,
    pick: [{ stages: [1, 2, 3, 4, 5], per: 4 }],
    name: 'かん字チェックの おまわりさん',
    line: 'ピピーッ！ とまりなさい！ ここまでの かん字を ちゃんと おぼえているか、しらべます！',
  },
  {
    id: 2, after: 10,
    // 6〜10 を 中心に、1〜5 も 少し まぜる
    pick: [{ stages: [6, 7, 8, 9, 10], per: 3 }, { stages: [1, 2, 3, 4, 5], per: 2 }],
    name: 'ふぶきの しろくま',
    line: 'ガオーッ！ わすれんぼうは この{先:さき}へ {通:とお}さないよ！',
  },
];

export const midBossOf = (id: number) => MID_BOSSES.find((m) => m.id === id)!;
export const midBossStages = (m: MidBoss) => m.pick.flatMap((p) => p.stages);
export const midBossCount = (m: MidBoss) => m.pick.reduce((s, p) => s + p.stages.length * p.per, 0);

/** 今 あらわれる 中ボス（after の ボスを たおしていて、まだ たおしていない さいしょの 中ボス） */
export function pendingMidBoss(bossCleared: (stage: number) => boolean, midCleared: (id: number) => boolean): MidBoss | null {
  return MID_BOSSES.find((m) => bossCleared(m.after) && !midCleared(m.id)) ?? null;
}

/**
 * 中ボスせん：ステージごとに per 字ずつ えらんで 1字1問。にがての 字 → 身についていない 字 の 順に えらぶ（同じくらいなら ばらばらに）。
 * 分野は ボスせんと 同じ ならびで、4わり 読み（おくりがなを まぜる）→ 4わり 書き → のこり 書きじゅん
 */
export function midBossSet(m: MidBoss, hist: (char: string) => Record<Mode, Outcome[]> | undefined, weak: Set<string>): QuizSet {
  const priority = (c: string) => (weak.has(c) ? -1 : 0) + kanjiMastery(hist(c) ?? { read: [], write: [], stroke: [], okuri: [] }) + Math.random() * 0.3;
  const chars = shuffle(m.pick.flatMap((p) => p.stages.flatMap((st) => {
    const scored = stageKanji(st).map((k) => ({ c: k.char, p: priority(k.char) }));
    return scored.sort((a, b) => a.p - b.p).slice(0, p.per).map((x) => x.c);
  })));
  const nRead = Math.round(chars.length * 0.4), nWrite = Math.round(chars.length * 0.4);
  const qs: Question[] = chars.map((c, i) =>
    i < nRead ? makeQuestion(c, canAsk(c, 'okuri') && Math.random() < 0.5 ? 'okuri' : 'read')
      : i < nRead + nWrite ? makeQuestion(c, 'write')
        : makeQuestion(c, 'stroke'));
  return { kind: 'midboss', stage: null, mid: m.id, questions: qs };
}
