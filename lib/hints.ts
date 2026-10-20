// まちがえたときのヒント文（記法つき。<Mk> で表示する）
import { kanjiOf } from './data';
import { parseTokens, targetOf } from './markup';
import type { Question } from './quiz';

export function hintFor(q: Question): string {
  const k = kanjiOf(q.char);
  switch (q.kind) {
    case 'read': {
      // ことばに ふりがなが 2つ以上 あれば、聞いている 字が 入っていない ほうの 読みを 教える（聞いている 字の 読みを 教えると 答えに なる）
      const other = parseTokens(targetOf(q.sentence)).find((t) => t.t === 'ruby' && !t.base.includes(q.char));
      if (other?.t === 'ruby') {
        return `おしい！ ヒント：「{${other.base}:${other.rt}}」は 「${other.rt}」と 読むよ。もう一回 書いてみよう！`;
      }
      // 答えが みじかい（2文字まで）ときは、さいしょの 文字を 教えると 答えが ほぼ わかるので 文字数だけ
      if (q.answer.length <= 2) return `おしい！ ヒント：ひらがな ${q.answer.length}文字 だよ。もう一回 書いてみよう！`;
      return `おしい！ ヒント：さいしょの 文字は 「${q.answer[0]}」。ぜんぶで ${q.answer.length}文字 だよ。もう一回 書いてみよう！`;
    }
    case 'write': {
      // その字が入ったことばを、その字を □ で かくして 見せる（字を そのまま 見せると 答えに なる）。
      // かき問題の文と 同じことばは さけ、ほかの 字と いっしょの ことば（引力 など）を えらぶ
      const plain = (w: string) => w.replace(/\{([^:}]+):[^}]+\}/g, '$1');
      const cands = k.words.filter((w) => !q.sentence.includes(plain(w)));
      const word = cands.find((w) => /\p{Script=Han}/u.test(plain(w).replaceAll(k.char, ''))) ?? cands[0] ?? k.words[0];
      const masked = word.replace(/\{([^:}]+):([^}]+)\}/g, (_, base: string, rt: string) => `{${base.replaceAll(k.char, '□')}:${rt}}`);
      return `おしい！ ヒント：${k.strokes}画の かん字。「${masked}」の □ に 入る 字だよ！`;
    }
    case 'okuri':
      return `おしい！ ヒント：「${q.stem}」までが かん字。{後:うし}ろに ひらがなが ${q.okuri.length}文字 つくよ。`;
    case 'stroke':
      return 'おしい！ 書きじゅんを 見てみよう。';
  }
}
