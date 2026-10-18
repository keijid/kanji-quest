// 画面の文言に出てくる かん字の よみ。<Mk> は 記法（{漢字:よみ}）のない かん字に ここから ふりがなを つける。
// 文言の かん字は 1・2年生で ならう字だけにする（かん字・れんしゅう などは まぜ書き）。
// ことばごとに書き、長い ことばから先に あてる。ここにない かん字は ふりがな なしで出る（tests/furi.test.ts で見張る）
import { isKanji, type Token } from './markup';

export const FURI: Record<string, string> = {
  字: 'じ', 文字: 'もじ', 日: 'にち', 今日: 'きょう', 一休: 'ひとやす', 今: 'いま',
  読: 'よ', 書: 'か', 方: 'かた', 見: 'み', 答: 'こた', 合: 'あ', 入: 'い', 赤: 'あか', 同: 'おな', 多: 'おお',
  画: 'かく', 画目: 'かくめ', 画数: 'かくすう', 何画: 'なんかく', 何画目: 'なんかくめ', 何番目: 'なんばんめ',
  後: 'あと', 回: 'かい', 一回: 'いっかい', 時: 'とき', 時間: 'じかん', 音: 'おん', 線: 'せん',
  手本: 'てほん', 地図: 'ちず', 年: 'ねん', 年生: 'ねんせい', 点: 'てん', 合格: 'ごうかく',
  名前: 'なまえ', 人: 'ひと', 見習: 'みなら',
};

const KEYS = Object.keys(FURI).sort((a, b) => b.length - a.length);

/** ふりがなの ない かん字を FURI で ruby にする。見つからない字は そのまま（missing に入れる） */
export function autoRuby(s: string, missing?: string[]): Token[] {
  const out: Token[] = [];
  let text = '';
  for (let i = 0; i < s.length; ) {
    const key = isKanji(s[i]) ? KEYS.find((k) => s.startsWith(k, i)) : undefined;
    if (!key) {
      if (isKanji(s[i])) missing?.push(s[i]);
      text += s[i++];
      continue;
    }
    if (text) out.push({ t: 'text', s: text });
    text = '';
    out.push({ t: 'ruby', base: key, rt: FURI[key] });
    i += key.length;
  }
  if (text) out.push({ t: 'text', s: text });
  return out;
}
