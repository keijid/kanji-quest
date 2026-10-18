import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

// localStorage の代わり（Node にはない）
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

const { db } = await import('@/lib/db');
const { MemoryBackend } = await import('@/lib/cloud/backend');
const { startSync, stopSync, flush } = await import('@/lib/cloud/sync');
const { resetAll } = await import('@/lib/progress');

const profile = (name: string) => ({ id: 'me' as const, name, partner: 'fire' as const, createdAt: 1 });
const kanji = (char: string) => ({ char, hist: { read: [2 as const], write: [2 as const], stroke: [], okuri: [] }, learned: true });

async function clearLocal() {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear(); });
}

describe('クラウド同期', () => {
  let cloud: InstanceType<typeof MemoryBackend>;
  beforeEach(async () => {
    await stopSync();
    await clearLocal();
    store.clear();
    cloud = new MemoryBackend();
  });

  it('はじめてログインしたとき、端末の記録をクラウドに上げる', async () => {
    await db.profile.put(profile('はると'));
    await db.kanji.put(kanji('光'));
    expect(await startSync('A', cloud)).toBe('uploaded');
    const snap = await cloud.pullAll('A');
    expect(snap.profile[0].name).toBe('はると');
    expect(snap.kanji.map((k) => k.char)).toEqual(['光']);
  });

  it('ログイン後の変更は、まとめてクラウドに書く（追加・更新・削除）', async () => {
    await startSync('A', cloud);
    await db.kanji.put(kanji('光'));
    await db.weak.put({ char: '後', addedAt: 5, streak: 0 });
    await flush();
    expect((await cloud.pullAll('A')).weak.map((w) => w.char)).toEqual(['後']);

    await db.weak.update('後', { streak: 1 });
    await db.weak.delete('後');
    await db.kanji.update('光', { learned: false });
    await flush();
    const snap = await cloud.pullAll('A');
    expect(snap.weak).toEqual([]);
    expect(snap.kanji[0].learned).toBe(false);
  });

  it('別の端末でログインすると、クラウドの記録を読みこむ', async () => {
    await cloud.write('A', [{ table: 'profile', key: 'me', value: profile('はると') }, { table: 'kanji', key: '雲', value: kanji('雲') }]);
    // この端末には古い記録がある（同じ人）
    await db.kanji.put(kanji('古'));
    expect(await startSync('A', cloud)).toBe('pulled');
    expect((await db.profile.get('me'))?.name).toBe('はると');
    expect((await db.kanji.toArray()).map((k) => k.char)).toEqual(['雲']);
    // 読みこんだ分をクラウドに書き戻さない
    await flush();
    expect((await cloud.pullAll('A')).kanji.map((k) => k.char)).toEqual(['雲']);
  });

  it('前に別の人が使っていた端末では、その記録を上げずに消す', async () => {
    await startSync('A', cloud);
    await db.profile.put(profile('Aの子'));
    await flush();
    // ログアウトせずに（＝記録が残ったまま）別の人がログイン
    await startSync('B', cloud);
    expect(await db.profile.get('me')).toBeUndefined();
    expect((await cloud.pullAll('B')).profile).toEqual([]);
    expect((await cloud.pullAll('A')).profile[0].name).toBe('Aの子');
  });

  it('ログアウトすると端末の記録を消し、クラウドには残る', async () => {
    await startSync('A', cloud);
    await db.kanji.put(kanji('光'));
    await stopSync();
    expect(await db.kanji.count()).toBe(0);
    expect((await cloud.pullAll('A')).kanji).toHaveLength(1);
  });

  it('「記録を消す」は、クラウドの記録も消す', async () => {
    await startSync('A', cloud);
    await db.kanji.put(kanji('光'));
    await db.profile.put(profile('はると'));
    await flush();
    await resetAll();
    await flush();
    const snap = await cloud.pullAll('A');
    expect(snap.kanji).toEqual([]);
    expect(snap.profile).toEqual([]);
    expect(snap.meta).toHaveLength(1); // 初期設定だけ残る
  });
});
