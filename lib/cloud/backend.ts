// クラウド保存の入れ物。本番は Firestore（./firestore.ts）、テストと開発ではメモリ・localStorage を使う
export type TableName = 'profile' | 'kanji' | 'weak' | 'stages' | 'days' | 'mocks' | 'meta';
export const TABLES: TableName[] = ['profile', 'kanji', 'weak', 'stages', 'days', 'mocks', 'meta'];

/** 各テーブルの主キー（IndexedDB のスキーマと同じ） */
export const PK: Record<TableName, string> = {
  profile: 'id',
  kanji: 'char',
  weak: 'char',
  stages: 'id',
  days: 'date',
  mocks: 'id',
  meta: 'id',
};

export type Row = Record<string, unknown>;
/** value が null なら削除 */
export type WriteOp = { table: TableName; key: string; value: Row | null };
export type Snapshot = Record<TableName, Row[]>;

export interface CloudBackend {
  /** その人の全データ */
  pullAll(uid: string): Promise<Snapshot>;
  write(uid: string, ops: WriteOp[]): Promise<void>;
  /** その人の全データを消す */
  wipe(uid: string): Promise<void>;
}

export const emptySnapshot = (): Snapshot => ({ profile: [], kanji: [], weak: [], stages: [], days: [], mocks: [], meta: [] });

/** テスト用：メモリに置く */
export class MemoryBackend implements CloudBackend {
  data = new Map<string, Map<string, Row>>(); // `${uid}/${table}` → key → row
  private col(uid: string, t: TableName) {
    const k = `${uid}/${t}`;
    if (!this.data.has(k)) this.data.set(k, new Map());
    return this.data.get(k)!;
  }
  async pullAll(uid: string) {
    const s = emptySnapshot();
    for (const t of TABLES) s[t] = [...this.col(uid, t).values()].map((r) => structuredClone(r));
    return s;
  }
  async write(uid: string, ops: WriteOp[]) {
    for (const op of ops) {
      if (op.value) this.col(uid, op.table).set(op.key, structuredClone(op.value));
      else this.col(uid, op.table).delete(op.key);
    }
  }
  async wipe(uid: string) {
    for (const t of TABLES) this.col(uid, t).clear();
  }
}

/** 開発用：localStorage に置く（Firestore のエミュレーターなしで、端末をまたぐ動きを試すため） */
export class LocalStorageBackend extends MemoryBackend {
  constructor() {
    super();
    try {
      const raw = localStorage.getItem('kq-fake-cloud');
      if (raw) this.data = new Map(Object.entries(JSON.parse(raw) as Record<string, Record<string, Row>>).map(([k, v]) => [k, new Map(Object.entries(v))]));
    } catch { /* 読めなければ空から */ }
  }
  private save() {
    localStorage.setItem('kq-fake-cloud', JSON.stringify(Object.fromEntries([...this.data].map(([k, v]) => [k, Object.fromEntries(v)]))));
  }
  async write(uid: string, ops: WriteOp[]) { await super.write(uid, ops); this.save(); }
  async wipe(uid: string) { await super.wipe(uid); this.save(); }
}
