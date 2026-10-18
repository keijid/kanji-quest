// 画面をまたぐ、今のセットの状態（端末には残さない。リロードに備えて sessionStorage にだけ置く）
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AnswerLog } from './progress';
import type { QuizSet } from './quiz';

export type LastResult = {
  set: QuizSet;
  logs: AnswerLog[];
  stars: number;
  newlyLearned: string[];
  learnedBefore: number;
  learnedAfter: number;
  bossCleared: boolean;
};

type GameState = {
  set: QuizSet | null;
  result: LastResult | null;
  /** 5かい れんしゅう の対象と、終わったあとの戻り先 */
  practice: { chars: string[]; returnTo: string } | null;
  startSet: (s: QuizSet) => void;
  finishSet: (r: LastResult) => void;
  startPractice: (chars: string[], returnTo: string) => void;
  endPractice: () => void;
};

export const useGame = create<GameState>()(
  persist(
    (set) => ({
      set: null,
      result: null,
      practice: null,
      startSet: (s) => set({ set: s }),
      finishSet: (r) => set({ set: null, result: r }),
      startPractice: (chars, returnTo) => set({ practice: { chars, returnTo } }),
      endPractice: () => set({ practice: null }),
    }),
    { name: 'kq-game', storage: createJSONStorage(() => sessionStorage) },
  ),
);
