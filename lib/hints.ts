// まちがえたときのヒント文（記法つき。<Mk> で表示する）
import { kanjiOf } from './data';
import { parseTokens, targetOf } from './markup';
import type { Question } from './quiz';

export function hintFor(q: Question): string {
  const k = kanjiOf(q.char);
  switch (q.kind) {
    case 'read': {
      const rubies = parseTokens(targetOf(q.sentence)).filter((t) => t.t === 'ruby');
      if (rubies.length >= 2 && rubies[0].t === 'ruby') {
        const r = rubies[0];
        return `おしい！ ヒント：「{${r.base}:${r.rt}}」は 「${r.rt}」と よむよ。もう いちど かいてみよう！`;
      }
      return `おしい！ ヒント：さいしょの もじは 「${q.answer[0]}」。ぜんぶで ${q.answer.length}もじ だよ。もう いちど かいてみよう！`;
    }
    case 'write': {
      // その字が入ったことばを見せる（見本どおり）。かき問題の文と同じことばはさける
      const word = k.words.find((w) => !q.sentence.includes(w.replace(/\{([^:}]+):[^}]+\}/g, '$1'))) ?? k.words[0];
      return `おしい！ ヒント：${k.strokes}かくの かんじ。${word} の「${k.char}」だよ！`;
    }
    case 'okuri':
      return `おしい！ ヒント：「${q.stem}」までが かんじ。うしろに ひらがなが ${q.okuri.length}もじ つくよ。`;
    case 'stroke':
      return 'おしい！ かきじゅんを みてみよう。';
  }
}
