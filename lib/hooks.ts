'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_META, emptyStars, type KanjiProgress, type Mode, type StageProgress } from './db';
import { currentStage, currentStreak, fieldRatesOf, levelOf, passPrediction, titleOf } from './progress';
import { evolution } from './partners';

/** アプリ全体でよく使う値。読み込み中は undefined */
export function useAppData() {
  return useLiveQuery(async () => {
    const [profile, meta, kanji, weak, stages, mocks] = await Promise.all([
      db.profile.get('me'),
      db.meta.get('main'),
      db.kanji.toArray(),
      db.weak.orderBy('addedAt').toArray(),
      db.stages.toArray(),
      db.mocks.toArray(),
    ]);
    const m = meta ?? DEFAULT_META;
    const learnedSet = new Set(kanji.filter((k) => k.learned).map((k) => k.char));
    const stageMap = new Map<number, StageProgress>(stages.map((s) => [s.id, s]));
    const cleared = new Set(stages.filter((s) => s.bossCleared).map((s) => s.id));
    const level = levelOf(m.xp);
    const fullMocks = mocks.filter((x) => x.kind === 'full');
    const bestFull = fullMocks.sort((a, b) => b.score - a.score)[0];
    const rates = fieldRatesOf(kanji);
    return {
      profile,
      meta: m,
      progress: new Map<string, KanjiProgress>(kanji.map((k) => [k.char, k])),
      learnedSet,
      learned: learnedSet.size,
      weak: weak.map((w) => w.char),
      stageStars: (id: number): Record<Mode, number> => stageMap.get(id)?.stars ?? emptyStars(),
      bossCleared: (id: number) => cleared.has(id),
      current: currentStage(cleared),
      level,
      title: titleOf(level),
      streak: currentStreak(m.streak),
      evo: evolution(learnedSet.size),
      rates,
      prediction: passPrediction(rates, learnedSet.size, bestFull),
      mocks,
      bestFull,
    };
  }, []);
}

export type AppData = NonNullable<ReturnType<typeof useAppData>>;
