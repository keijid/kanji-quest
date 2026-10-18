// Firestore に置く形：users/{uid}/{テーブル名}/{主キー}
import { collection, doc, getDocs, getDocsFromCache, writeBatch, type Firestore } from 'firebase/firestore';
import { emptySnapshot, TABLES, type CloudBackend, type Row, type WriteOp } from './backend';

const BATCH = 400; // 1回のまとめ書きの上限（Firestore は 500）
const PULL_TIMEOUT = 8000;

export class FirestoreBackend implements CloudBackend {
  constructor(private fs: Firestore) {}

  private col(uid: string, t: string) {
    return collection(this.fs, 'users', uid, t);
  }

  async pullAll(uid: string) {
    const s = emptySnapshot();
    await Promise.all(TABLES.map(async (t) => {
      const ref = this.col(uid, t);
      // つながらないときは、端末のキャッシュから読む
      const snap = await Promise.race([
        getDocs(ref),
        new Promise<null>((r) => setTimeout(() => r(null), PULL_TIMEOUT)),
      ]) ?? await getDocsFromCache(ref);
      s[t] = snap.docs.map((d) => d.data() as Row);
    }));
    return s;
  }

  async write(uid: string, ops: WriteOp[]) {
    for (let i = 0; i < ops.length; i += BATCH) {
      const b = writeBatch(this.fs);
      for (const op of ops.slice(i, i + BATCH)) {
        const ref = doc(this.fs, 'users', uid, op.table, op.key);
        if (op.value) b.set(ref, op.value);
        else b.delete(ref);
      }
      // オフラインのときは送信待ちになり、つながったら送られる。待たずに次へ進む
      void b.commit().catch((e) => console.warn('[firestore] 書き込みに失敗', e));
    }
  }

  async wipe(uid: string) {
    const ops: WriteOp[] = [];
    for (const t of TABLES) {
      const snap = await getDocs(this.col(uid, t));
      for (const d of snap.docs) ops.push({ table: t, key: d.id, value: null });
    }
    await this.write(uid, ops);
  }
}
