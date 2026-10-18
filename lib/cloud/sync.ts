// 端末の IndexedDB（画面はこちらを読む）と、クラウドの同期
//
// - ログインしたとき：クラウドに記録があれば、端末の記録をクラウドの内容に置きかえる。
//   クラウドが空なら、端末の記録（ログイン機能を入れる前の記録）をクラウドに上げる。
//   ただし端末の記録が別の人のものなら、上げずに消す。
// - そのあと：IndexedDB が変わるたびに、変わった行だけをクラウドに書く（少し待ってまとめて）。
// - ログアウトしたとき：端末の記録を消す（次にログインする人に見えないように）。
import type { Table } from 'dexie';
import { db } from '../db';
import { emptySnapshot, PK, TABLES, type CloudBackend, type Row, type Snapshot, type TableName, type WriteOp } from './backend';

const OWNER_KEY = 'kq-owner';
const FLUSH_MS = 800;

const table = (t: TableName) => db.table(t) as Table<Row, unknown>;
const keyStr = (k: unknown) => String(k);
/** Firestore は undefined を保存できないので、JSON で通しておく */
const clean = (r: Row): Row => JSON.parse(JSON.stringify(r)) as Row;

type State = { uid: string; backend: CloudBackend };
let state: State | null = null;
let applyingRemote = false;
let hooksAttached = false;
const dirty = new Map<string, { table: TableName; key: unknown }>();
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> = Promise.resolve();

const owner = {
  get: () => { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } },
  set: (v: string | null) => { try { if (v) localStorage.setItem(OWNER_KEY, v); else localStorage.removeItem(OWNER_KEY); } catch { /* 保存できなくても続ける */ } },
};

function mark(t: TableName, key: unknown) {
  if (applyingRemote || !state || key === undefined) return;
  dirty.set(`${t}\u0000${keyStr(key)}`, { table: t, key });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), FLUSH_MS);
}

function attachHooks() {
  if (hooksAttached) return;
  hooksAttached = true;
  for (const t of TABLES) {
    const tb = table(t);
    tb.hook('creating', (pk, obj) => { mark(t, pk ?? (obj as Row)[PK[t]]); });
    tb.hook('updating', (_mods, pk) => { mark(t, pk); });
    tb.hook('deleting', (pk) => { mark(t, pk); });
  }
}

/** たまっている変更をクラウドに書く */
export function flush(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  flushing = flushing.then(async () => {
    const s = state;
    if (!s || !dirty.size) return;
    const items = [...dirty.values()];
    dirty.clear();
    const ops: WriteOp[] = await Promise.all(items.map(async ({ table: t, key }) => {
      const v = await table(t).get(key as never);
      return { table: t, key: keyStr(key), value: v ? clean(v) : null };
    }));
    try {
      await s.backend.write(s.uid, ops);
    } catch (e) {
      // 書けなかった行は、次の機会にもう一度
      for (const it of items) dirty.set(`${it.table}\u0000${keyStr(it.key)}`, it);
      console.warn('[sync] クラウドに書けませんでした', e);
    }
  });
  return flushing;
}

async function readLocal(): Promise<Snapshot> {
  const s = emptySnapshot();
  for (const t of TABLES) s[t] = await table(t).toArray();
  return s;
}

const isEmpty = (s: Snapshot) => TABLES.every((t) => s[t].length === 0);

async function replaceLocal(s: Snapshot) {
  applyingRemote = true;
  try {
    await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
      for (const t of TABLES) {
        await table(t).clear();
        if (s[t].length) await table(t).bulkPut(s[t]);
      }
    });
  } finally {
    applyingRemote = false;
  }
}

export type StartResult = 'pulled' | 'uploaded' | 'empty';

/** ログインしたら呼ぶ。終わってから画面を出す */
export async function startSync(uid: string, backend: CloudBackend): Promise<StartResult> {
  attachHooks();
  const remote = await backend.pullAll(uid);
  const prevOwner = owner.get();
  let result: StartResult;
  if (!isEmpty(remote)) {
    await replaceLocal(remote);
    result = 'pulled';
  } else if (prevOwner && prevOwner !== uid) {
    // 別の人の記録が端末に残っている → 上げずに消す
    await replaceLocal(emptySnapshot());
    result = 'empty';
  } else {
    const local = await readLocal();
    if (isEmpty(local)) result = 'empty';
    else {
      await backend.write(uid, TABLES.flatMap((t) => local[t].map((r) => ({ table: t, key: keyStr(r[PK[t]]), value: clean(r) }))));
      result = 'uploaded';
    }
  }
  owner.set(uid);
  state = { uid, backend };
  return result;
}

/** ログアウトの前に呼ぶ。たまっている変更を書いてから、端末の記録を消す */
export async function stopSync() {
  await flush();
  state = null;
  dirty.clear();
  await replaceLocal(emptySnapshot());
  owner.set(null);
}

/** 「記録を消す」：クラウドの記録も消す */
export async function wipeCloud() {
  if (!state) return;
  dirty.clear();
  await state.backend.wipe(state.uid);
}

export const syncActive = () => state !== null;
