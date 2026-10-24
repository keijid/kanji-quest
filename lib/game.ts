// 画面をまたぐ、今のセットの状態（端末には残さない。リロードに備えて sessionStorage にだけ置く）
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AnswerLog } from './progress';
import type { QuizSet } from './quiz';

/** 書いて れんしゅう の 回数：1字ずつの練習（おぼえよう から）は 3回、かん字ずかんからの ふくしゅうは 5回 */
export const LESSON_TIMES = 3;
export const REVIEW_TIMES = 5;

export type LastResult = {
  set: QuizSet;
  logs: AnswerLog[];
  stars: number;
  newlyLearned: string[];
  learnedBefore: number;
  learnedAfter: number;
  /** 練習ずみの字数（相棒の しんか）。古い セーブには ないので ?? で learned に もどす */
  practicedBefore?: number;
  practicedAfter?: number;
  bossCleared: boolean;
};

type GameState = {
  set: QuizSet | null;
  result: LastResult | null;
  /** 書いて れんしゅう の対象と、やめたときの戻り先。then='lesson' なら、書きおわったら その字の もんだいへ進む */
  practice: { chars: string[]; returnTo: string; then?: 'lesson' } | null;
  /** 1字ずつの練習で「おぼえよう」画面に出す字 */
  lesson: string | null;
  startLesson: (char: string) => void;
  startSet: (s: QuizSet) => void;
  finishSet: (r: LastResult) => void;
  startPractice: (chars: string[], returnTo: string, then?: 'lesson') => void;
  endPractice: () => void;
};

export const useGame = create<GameState>()(
  persist(
    (set) => ({
      set: null,
      result: null,
      practice: null,
      lesson: null,
      startLesson: (char) => set({ lesson: char }),
      startSet: (s) => set({ set: s }),
      finishSet: (r) => set({ set: null, result: r }),
      startPractice: (chars, returnTo, then) => set({ practice: { chars, returnTo, then } }),
      endPractice: () => set({ practice: null }),
    }),
    { name: 'kq-game', storage: createJSONStorage(() => sessionStorage) },
  ),
);
