// 進み具合のルール（PLAN.md「ルールの決め方」）
import { db, DEFAULT_META, emptyHist, emptyStars, getMeta, today, MODES, type Mode, type Outcome, type MockResult } from './db';
import { STAGE_COUNT, stageKanji, TOTAL } from './data';
import { wipeCloud } from './cloud/sync';

const HIST_LEN = 10;

export const XP = { first: 10, hint: 5, practice: 2 } as const;

// ---- 経験値・レベル・称号 ----
/** レベル n になるのに必要な経験値の累計 = 10·n·(n−1) */
export const xpForLevel = (n: number) => 10 * n * (n - 1);
export function levelOf(xp: number) {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}
const TITLES: [number, string][] = [
  [1, 'かけだし たびびと'],
  [6, '{見習:みなら}いけんし'],
  [15, 'かんじ けんし'],
  [25, 'かんじ きし'],
  [35, 'かんじ はかせ'],
  [50, 'かんじ マスター'],
];
export const titleOf = (level: number) => [...TITLES].reverse().find(([l]) => level >= l)![1];

// ---- 星 ----
export function starsFor(correct: number, total: number) {
  if (!total) return 0;
  const r = correct / total;
  return r >= 1 ? 3 : r >= 0.8 ? 2 : r >= 0.5 ? 1 : 0;
}

// ---- 1問の結果を記録 ----
export type AnswerLog = { char: string; mode: Mode; outcome: Outcome };

/**
 * セットの結果をまとめて保存する。
 * - 習得：よみ と かき の両方で正解（ヒントのあとの正解を含む）したら「覚えた」
 * - 苦手：まちがい（2回目もまちがい）で追加。追加後に2回続けて正解したら外す
 */
export async function recordAnswers(logs: AnswerLog[]) {
  const newlyLearned: string[] = [];
  await db.transaction('rw', [db.kanji, db.weak, db.meta, db.days], async () => {
    for (const { char, mode, outcome } of logs) {
      const p = (await db.kanji.get(char)) ?? { char, hist: emptyHist(), learned: false };
      p.hist[mode] = [...p.hist[mode], outcome].slice(-HIST_LEN);
      if (!p.learned && p.hist.read.some((o) => o > 0) && p.hist.write.some((o) => o > 0)) {
        p.learned = true;
        p.learnedAt = Date.now();
        newlyLearned.push(char);
      }
      await db.kanji.put(p);

      const w = await db.weak.get(char);
      if (outcome === 0) await db.weak.put({ char, addedAt: w?.addedAt ?? Date.now(), streak: 0 });
      else if (w) {
        if (w.streak + 1 >= 2) await db.weak.delete(char);
        else await db.weak.put({ ...w, streak: w.streak + 1 });
      }
    }
    const gained = logs.reduce((s, l) => s + (l.outcome === 2 ? XP.first : l.outcome === 1 ? XP.hint : 0), 0);
    await addXp(gained);
    await touchDay(logs.length);
  });
  return { newlyLearned };
}

export async function addXp(n: number) {
  const m = await getMeta();
  await db.meta.put({ ...m, xp: m.xp + n });
}

/** 学習した日として記録し、連続日数を更新する */
export async function touchDay(answered = 0) {
  const d = today();
  const day = (await db.days.get(d)) ?? { date: d, seconds: 0, answered: 0 };
  await db.days.put({ ...day, answered: day.answered + answered });
  const m = await getMeta();
  const s = m.streak;
  if (s.lastDate === d) return;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const current = s.lastDate === today(y) ? s.current + 1 : 1;
  await db.meta.put({ ...m, streak: { current, best: Math.max(s.best, current), lastDate: d } });
}

/** 画面を見ている時間を足す（AppShell が定期的に呼ぶ） */
export async function addStudySeconds(sec: number) {
  const d = today();
  await db.transaction('rw', db.days, async () => {
    const day = (await db.days.get(d)) ?? { date: d, seconds: 0, answered: 0 };
    await db.days.put({ ...day, seconds: day.seconds + sec });
  });
}

/** 今の連続日数（最後に学習した日が昨日より前なら 0） */
export function currentStreak(s: { current: number; lastDate: string | null }) {
  if (!s.lastDate) return 0;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return s.lastDate === today() || s.lastDate === today(y) ? s.current : 0;
}

// ---- ステージ ----
export async function saveStageStars(stage: number, mode: Mode, stars: number) {
  const s = (await db.stages.get(stage)) ?? { id: stage, stars: emptyStars(), bossCleared: false };
  s.stars[mode] = Math.max(s.stars[mode], stars);
  await db.stages.put(s);
}
export async function clearBoss(stage: number) {
  const s = (await db.stages.get(stage)) ?? { id: stage, stars: emptyStars(), bossCleared: false };
  await db.stages.put({ ...s, bossCleared: true });
}
/** ボスせん：4モードすべてで★1以上 */
export const bossUnlocked = (stars: Record<Mode, number>) => MODES.every((m) => stars[m] >= 1);

/** 今いるステージ ＝ ボスをまだ倒していない最初のステージ */
export function currentStage(cleared: Set<number>) {
  for (let i = 1; i <= STAGE_COUNT; i++) if (!cleared.has(i)) return i;
  return STAGE_COUNT;
}

// ---- 合格予想 ----
/**
 * 分野別の直近の正答率の平均 × 0.6 ＋ 習得率 × 0.4。もぎテスト（ほんばん）の最高点があれば半分ずつ混ぜる。
 * 0〜100 の整数。
 */
export function passPrediction(fieldRates: Record<Mode, number | null>, learned: number, bestFull: MockResult | undefined) {
  const rates = MODES.map((m) => fieldRates[m]).filter((r): r is number => r !== null);
  const acc = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  let p = acc * 0.6 + (learned / TOTAL) * 0.4;
  if (bestFull) p = p * 0.5 + (bestFull.score / bestFull.max) * 0.5;
  return Math.round(p * 100);
}

/** 分野別の正答率（直近の履歴。正解＝ヒント後も含む）。記録がなければ null */
export function fieldRatesOf(progress: { hist: Record<Mode, Outcome[]> }[]): Record<Mode, number | null> {
  const out = {} as Record<Mode, number | null>;
  for (const m of MODES) {
    const all = progress.flatMap((p) => p.hist[m]);
    out[m] = all.length ? all.filter((o) => o > 0).length / all.length : null;
  }
  return out;
}

/** 「記録を消す」：端末とクラウド（ログインしていれば）の記録をすべて消す */
export async function resetAll() {
  await wipeCloud();
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  await db.meta.put(DEFAULT_META);
}

export { stageKanji };
