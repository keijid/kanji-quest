import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

const { db } = await import('@/lib/db');
const { recordAnswers } = await import('@/lib/progress');

const weak = async () => (await db.weak.toArray()).map((w) => w.char).sort();

describe('にがて', () => {
  beforeEach(async () => { await db.weak.clear(); await db.kanji.clear(); });

  it('ボスせん いがいで まちがえても にがてに 入れない', async () => {
    await recordAnswers([{ char: '光', mode: 'read', outcome: 0 }]);
    expect(await weak()).toEqual([]);
  });

  it('ボスせんで まちがえたら にがてに 入れる', async () => {
    await recordAnswers([{ char: '光', mode: 'write', outcome: 0 }, { char: '雲', mode: 'read', outcome: 2 }], { addWeak: true });
    expect(await weak()).toEqual(['光']);
  });

  it('にがての字は 2回つづけて 正解すると はずれる。とちゅうで まちがえると やり直し', async () => {
    await recordAnswers([{ char: '光', mode: 'write', outcome: 0 }], { addWeak: true });
    await recordAnswers([{ char: '光', mode: 'write', outcome: 2 }]);
    await recordAnswers([{ char: '光', mode: 'read', outcome: 0 }]);
    await recordAnswers([{ char: '光', mode: 'write', outcome: 2 }]);
    expect(await weak()).toEqual(['光']);
    await recordAnswers([{ char: '光', mode: 'write', outcome: 1 }]);
    expect(await weak()).toEqual([]);
  });
});
