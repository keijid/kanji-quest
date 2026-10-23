// 問題セットの作り方
import { KANJI, kanjiOf, STROKES, stageKanji } from './data';
import type { Mode } from './db';
import { splitOkuri, targetOf, parseTokens, reading } from './markup';

export type Question =
  | { kind: 'read'; char: string; sentence: string; answer: string }
  | { kind: 'write'; char: string; sentence: string }
  | { kind: 'okuri'; char: string; sentence: string; stem: string; okuri: string }
  | { kind: 'stroke'; char: string; sub: 'nth' | 'total'; index: number };

export type SetKind = Mode | 'boss' | 'midboss' | 'review' | 'lesson';

export type QuizSet = {
  kind: SetKind;
  stage: number | null;
  /** 1字ずつの練習の字 */
  char?: string;
  /** 中ボスせんの 中ボス（lib/midboss.ts） */
  mid?: number;
  questions: Question[];
};

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export const canAsk = (char: string, mode: Mode) => mode !== 'okuri' || kanjiOf(char).questions.okuri.length > 0;

export function makeQuestion(char: string, mode: Mode): Question {
  const k = kanjiOf(char);
  switch (mode) {
    case 'read': {
      const sentence = pick(k.questions.read);
      return { kind: 'read', char, sentence, answer: reading(parseTokens(targetOf(sentence))) };
    }
    case 'write':
      return { kind: 'write', char, sentence: pick(k.questions.write) };
    case 'okuri': {
      const sentence = pick(k.questions.okuri);
      return { kind: 'okuri', char, sentence, ...splitOkuri(targetOf(sentence)) };
    }
    case 'stroke': {
      const n = STROKES[char].length;
      // 12画をこえる字は「なんかくめ」だけ（数字ボタンが 1〜12 のため）
      const sub = n > 12 || (n > 1 && Math.random() < 0.6) ? 'nth' : 'total';
      const index = sub === 'nth' ? Math.floor(Math.random() * Math.min(n, 12)) : n - 1;
      return { kind: 'stroke', char, sub, index };
    }
  }
}

/** ステージのモード別セット（10字。おくりがなは対象の字だけ。5問に満たなければ前のステージから足す） */
export function stageSet(stage: number, mode: Mode): QuizSet {
  let chars = stageKanji(stage).map((k) => k.char).filter((c) => canAsk(c, mode));
  if (mode === 'okuri' && chars.length < 5) {
    const earlier = KANJI.filter((k) => k.stage < stage && canAsk(k.char, 'okuri')).map((k) => k.char);
    chars = [...chars, ...shuffle(earlier).slice(0, 5 - chars.length)];
  }
  return { kind: mode, stage, questions: shuffle(chars).map((c) => makeQuestion(c, mode)) };
}

/**
 * 1字ずつの練習：その字だけを よみ（ちがう文で2問まで）→ おくりがな（ある字だけ）→ かき → かきじゅん の順に
 */
export function lessonSet(char: string): QuizSet {
  const k = kanjiOf(char);
  const reads = shuffle(k.questions.read).slice(0, 2).map((sentence): Question => ({
    kind: 'read', char, sentence, answer: reading(parseTokens(targetOf(sentence))),
  }));
  const qs: Question[] = [...reads];
  if (canAsk(char, 'okuri')) qs.push(makeQuestion(char, 'okuri'));
  qs.push(makeQuestion(char, 'write'), makeQuestion(char, 'stroke'));
  return { kind: 'lesson', stage: k.stage, char, questions: qs };
}

/**
 * ボスせん：ステージの10字すべてを、よみ → かき → かきじゅん の順に1問ずつ（各10問・計30問）。
 * おくりがなは「よみ」にまぜる：おくりがなのある字は、半分の確率で よみ の代わりに おくりがな を出す
 */
export function bossSet(stage: number): QuizSet {
  const chars = stageKanji(stage).map((k) => k.char);
  const reads = shuffle(chars).map((c) => makeQuestion(c, canAsk(c, 'okuri') && Math.random() < 0.5 ? 'okuri' : 'read'));
  const writes = shuffle(chars).map((c) => makeQuestion(c, 'write'));
  const strokes = shuffle(chars).map((c) => makeQuestion(c, 'stroke'));
  return { kind: 'boss', stage, questions: [...reads, ...writes, ...strokes] };
}

/** ふくしゅう：苦手の字（多くて10字）を よみ・かき で */
export function reviewSet(weak: string[]): QuizSet {
  const chars = shuffle(weak).slice(0, 10);
  return { kind: 'review', stage: null, questions: chars.map((c) => makeQuestion(c, pick<Mode>(['read', 'write', 'write', 'stroke']))) };
}

export const modeOf = (q: Question): Mode => q.kind;

/** 答えの字 */
export function answerText(q: Question): string {
  switch (q.kind) {
    case 'read': return q.answer;
    case 'write': return q.char;
    case 'okuri': return q.char + q.okuri;
    case 'stroke': return String(q.index + 1);
  }
}
