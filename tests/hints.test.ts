import { describe, expect, it } from 'vitest';
import { hintFor } from '@/lib/hints';

describe('読みの ヒント', () => {
  it('みじかい 答えは 文字数（マスで 見えている）では なく、その字の ほかの 読み方を 教える', () => {
    const h = hintFor({ kind: 'read', char: '近', sentence: '[{近:きん}]じょの いぬ。', answer: 'きん' });
    expect(h).toContain('「ちかい」とも 読む');
    expect(h).not.toContain('きん');
  });

  it('ことばの 中の 1字（理科 の 科）では、ほかの 読み方を 出さない（科 は りか でも か と 読む）', () => {
    const h = hintFor({ kind: 'read', char: '科', sentence: '[{理科:りか}]の じっけん。', answer: 'りか' });
    expect(h).not.toContain('とも 読む');
  });
});
