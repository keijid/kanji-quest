// 進み具合のルール（PLAN.md「ルールの決め方」）
import { db, DEFAULT_META, emptyHist, emptyStars, getMeta, today, MODES, type Mode, type Outcome, type MockResult } from './db';
import { STAGE_COUNT, stageKanji, TOTAL } from './data';
import { wipeCloud } from './cloud/sync';

const HIST_LEN = 10;

export const XP = { first: 10, hint: 5, practice: 2 } as const;

// ---- 経験値・レベル・称号 ----
/** レベル n になるのに必要な経験値の累計 = 3.5·n·(n−1)（160字を 練習と ボスせんで 7わりくらい せいかいして やり切ると Lv.50） */
export const xpForLevel = (n: number) => 7 * n * (n - 1) / 2;
export function levelOf(xp: number) {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}
// 竜の 力を うけつぐ 勇者の 出世（段階ごとに 勇者の 絵が かわる）
export const TITLES: [number, string][] = [
  [1, 'かけだし ゆうしゃ'],
  [6, 'りゅうの みならい'],
  [15, 'りゅうの けんし'],
  [25, 'ドラゴン ナイト'],
  [35, 'ほのおの まけんし'],
  [50, 'でんせつの ドラゴンゆうしゃ'],
];
export const titleOf = (level: number) => [...TITLES].reverse().find(([l]) => level >= l)![1];
/** 称号の段階 1〜6（勇者の絵 public/heroes/hero-<段階>.png・顔 face-<段階>.png） */
export const titleRank = (level: number) => TITLES.filter(([l]) => level >= l).length;

// ---- 星 ----
export function starsFor(correct: number, total: number) {
  if (!total) return 0;
  const r = correct / total;
  // 1字ずつの 練習は 3〜4問なので、1問 まちがえただけで 8わりを 下回る。1問 まちがいは 2つ星に する
  const twoStars = r >= 0.8 || (total - correct === 1 && r >= 0.5);
  return r >= 1 ? 3 : twoStars ? 2 : r >= 0.5 ? 1 : 0;
}

// ---- 1問の結果を記録 ----
export type AnswerLog = { char: string; mode: Mode; outcome: Outcome };

/**
 * セットの結果をまとめて保存する。
 * - 習得：よみ と かき の両方で正解（ヒントのあとの正解を含む）したら「覚えた」
 * - 苦手：addWeak のとき（ボスせん）だけ、1回でも まちがえたら（ヒントの あとの 正解も）追加する。
 *   すでに苦手の字は、どこで まちがえても やり直し。1回目で 2回続けて正解したら外す
 */
export async function recordAnswers(logs: AnswerLog[], { addWeak = false }: { addWeak?: boolean } = {}) {
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
      // ヒントの あとの 正解（1）も まちがい あつかい
      if (outcome < 2) {
        if (w || addWeak) await db.weak.put({ char, addedAt: w?.addedAt ?? Date.now(), streak: 0 });
      }
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
/** 1字ずつの練習を終えたしるし */
export async function markPracticed(char: string) {
  const p = (await db.kanji.get(char)) ?? { char, hist: emptyHist(), learned: false };
  if (p.practiced) return;
  await db.kanji.put({ ...p, practiced: true, practicedAt: Date.now() });
}
/** 練習ずみか（前の版で「おぼえた」になった字も練習ずみとみなす） */
export const isPracticed = (p: { practiced?: boolean; learned: boolean } | undefined) => !!p && (!!p.practiced || p.learned);

export async function clearBoss(stage: number) {
  const s = (await db.stages.get(stage)) ?? { id: stage, stars: emptyStars(), bossCleared: false };
  await db.stages.put({ ...s, bossCleared: true });
}
/** 中ボスを たおした しるし */
export async function clearMidBoss(id: number) {
  const m = await getMeta();
  const done = m.midBossCleared ?? [];
  if (!done.includes(id)) await db.meta.put({ ...m, midBossCleared: [...done, id] });
}
/** ボスせん：そのステージの10字をすべて1字ずつ練習した */
export const bossUnlocked = (stage: number, practiced: Set<string>) => stageKanji(stage).every((k) => practiced.has(k.char));

/** 今いるステージ ＝ ボスをまだ倒していない最初のステージ */
export function currentStage(cleared: Set<number>) {
  for (let i = 1; i <= STAGE_COUNT; i++) if (!cleared.has(i)) return i;
  return STAGE_COUNT;
}

// ---- 合格予想 ----
/**
 * 1字の身につき具合 0〜1。全分野の直近の答え（新しい順に最大6つ）から：1回目で正解＝1、ヒントのあと正解＝0.6、まちがい＝0。
 * 答えた数が3つに満たないうちは、その分だけ割り引く（1問だけ正解しても 1 にはしない）
 */
const RECENT = 6;
const CONFIDENT = 3;
export function kanjiMastery(hist: Record<Mode, Outcome[]>) {
  // 分野ごとの履歴は古い順。分野をまたいで新しいものから取る（各分野の末尾から交互に）
  const lists = MODES.map((m) => [...hist[m]].reverse());
  const recent: Outcome[] = [];
  for (let i = 0; recent.length < RECENT && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length && recent.length < RECENT) recent.push(l[i]);
  }
  if (!recent.length) return 0;
  const score = recent.reduce((s: number, o) => s + (o === 2 ? 1 : o === 1 ? 0.6 : 0), 0) / recent.length;
  return score * Math.min(1, recent.length / CONFIDENT);
}

/**
 * 合格予想 0〜100：学習の対象（160字）それぞれの身につき具合の平均（まだやっていない字は 0）。
 * もぎテスト（ほんばん。160字から出る）の最高点があれば、半分ずつ混ぜる
 */
export function passPrediction(progress: { char: string; hist: Record<Mode, Outcome[]> }[], targets: Set<string>, bestFull: MockResult | undefined) {
  const sum = progress.filter((p) => targets.has(p.char)).reduce((s, p) => s + kanjiMastery(p.hist), 0);
  let p = sum / TOTAL;
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
