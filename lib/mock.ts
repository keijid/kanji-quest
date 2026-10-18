// もぎテスト。ほんばん＝よみ・かき・かきじゅん/かくすう（40分・150点）、ミニ＝20問・10分（苦手多め）
import { KANJI } from './data';
import type { MockField } from './db';
import { makeQuestion, shuffle, type Question } from './quiz';

export type MockSection = { field: MockField; questions: Question[] };
export type MockTest = { kind: 'full' | 'mini'; minutes: number; points: number; sections: MockSection[] };

export const FIELD_TITLE: Record<MockField, string> = { read: 'よみ', write: 'かき', stroke: 'かきじゅん・かくすう' };
export const FULL = { read: 30, write: 30, stroke: 15, points: 2, minutes: 40, pass: 120 };
export const MINI = { count: 20, weakMax: 12, minutes: 10 };

const all = () => shuffle(KANJI.map((k) => k.char));

export function buildMock(kind: 'full' | 'mini', weak: string[]): MockTest {
  if (kind === 'full') {
    return {
      kind,
      minutes: FULL.minutes,
      points: FULL.points,
      sections: (['read', 'write', 'stroke'] as MockField[]).map((field) => ({
        field,
        questions: all().slice(0, FULL[field]).map((c) => makeQuestion(c, field)),
      })),
    };
  }
  const w = shuffle(weak).slice(0, MINI.weakMax);
  const chars = [...w, ...all().filter((c) => !w.includes(c))].slice(0, MINI.count);
  const by: Record<MockField, Question[]> = { read: [], write: [], stroke: [] };
  chars.forEach((c, i) => {
    const f = (['read', 'write', 'stroke'] as MockField[])[i % 3];
    by[f].push(makeQuestion(c, f));
  });
  return {
    kind,
    minutes: MINI.minutes,
    points: 1,
    sections: (['read', 'write', 'stroke'] as MockField[]).map((field) => ({ field, questions: by[field] })),
  };
}

export const maxScore = (t: MockTest) => t.sections.reduce((s, x) => s + x.questions.length, 0) * t.points;
