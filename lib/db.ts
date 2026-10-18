import Dexie, { type EntityTable } from 'dexie';
import type { PartnerId } from './partners';

export type Mode = 'read' | 'write' | 'stroke' | 'okuri';
export const MODES: Mode[] = ['read', 'write', 'stroke', 'okuri'];

/** 1問の結果：2＝1回目で正解、1＝ヒントのあと正解、0＝まちがい（正解を表示） */
export type Outcome = 0 | 1 | 2;

export type Profile = { id: 'me'; name: string; partner: PartnerId; createdAt: number };

export type KanjiProgress = {
  char: string;
  hist: Record<Mode, Outcome[]>;
  learned: boolean;
  learnedAt?: number;
};

export type Weak = { char: string; addedAt: number; streak: number };

export type StageProgress = { id: number; stars: Record<Mode, number>; bossCleared: boolean };

/** 日ごとの学習時間 */
export type Day = { date: string; seconds: number; answered: number };

export type MockField = 'read' | 'write' | 'stroke';
export type MockResult = {
  id?: number;
  kind: 'full' | 'mini';
  score: number;
  max: number;
  byField: Partial<Record<MockField, { correct: number; total: number }>>;
  at: number;
};

export type Settings = { goalMin: number; limitMin: number; sfx: boolean };
export type Meta = {
  id: 'main';
  xp: number;
  streak: { current: number; best: number; lastDate: string | null };
  settings: Settings;
};

export const DEFAULT_META: Meta = {
  id: 'main',
  xp: 0,
  streak: { current: 0, best: 0, lastDate: null },
  settings: { goalMin: 15, limitMin: 45, sfx: true },
};

export const emptyHist = (): Record<Mode, Outcome[]> => ({ read: [], write: [], stroke: [], okuri: [] });
export const emptyStars = (): Record<Mode, number> => ({ read: 0, write: 0, stroke: 0, okuri: 0 });

export class KanjiQuestDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  kanji!: EntityTable<KanjiProgress, 'char'>;
  weak!: EntityTable<Weak, 'char'>;
  stages!: EntityTable<StageProgress, 'id'>;
  days!: EntityTable<Day, 'date'>;
  mocks!: EntityTable<MockResult, 'id'>;
  meta!: EntityTable<Meta, 'id'>;

  constructor() {
    super('kanji-quest');
    this.version(1).stores({
      profile: 'id',
      kanji: 'char, learned',
      weak: 'char, addedAt',
      stages: 'id',
      days: 'date',
      mocks: '++id, kind, at',
      meta: 'id',
    });
  }
}

export const db = new KanjiQuestDB();

export async function getMeta(): Promise<Meta> {
  return (await db.meta.get('main')) ?? DEFAULT_META;
}

/** 端末のタイムゾーンでの日付（YYYY-MM-DD） */
export function today(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
