import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autoRuby } from '@/lib/furi';
import { STAGE_NAMES } from '@/lib/data';
import { parseTokens } from '@/lib/markup';

// 子どもが見る画面の ファイル（保護者画面・クレジットは おとな向けなので のぞく）
const FILES = [
  'app/home/page.tsx', 'app/stage/[id]/StageScreen.tsx', 'app/lesson/page.tsx', 'app/play/page.tsx', 'app/result/page.tsx',
  'app/zukan/page.tsx', 'app/practice/page.tsx', 'app/mock/page.tsx', 'app/onboard/page.tsx',
  'components/AdventureMap.tsx', 'components/play/WriteQ.tsx', 'lib/hints.ts', 'lib/mock.ts',
];

/** コメントを のぞいた、文字列と JSX の文 */
function texts(src: string): string[] {
  const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const out: string[] = [];
  for (const m of code.matchAll(/'([^'\n]*)'|`([^`]*)`|>([^<>{}]+)</g)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

describe('画面の かん字には ふりがなが つく', () => {
  it.each(FILES)('%s', (f) => {
    const missing: string[] = [];
    for (const t of texts(readFileSync(f, 'utf8'))) {
      for (const tok of parseTokens(t)) if (tok.t === 'text' && !tok.raw) autoRuby(tok.s, missing);
    }
    expect(missing).toEqual([]);
  });

  it('ステージ名', () => {
    const missing: string[] = [];
    for (const n of STAGE_NAMES) for (const tok of parseTokens(n)) if (tok.t === 'text') autoRuby(tok.s, missing);
    expect(missing).toEqual([]);
  });

  it('長い ことばから あてる', () => {
    expect(autoRuby('今日は 何画目')).toEqual([
      { t: 'ruby', base: '今日', rt: 'きょう' }, { t: 'text', s: 'は ' }, { t: 'ruby', base: '何画目', rt: 'なんかくめ' },
    ]);
  });
});
