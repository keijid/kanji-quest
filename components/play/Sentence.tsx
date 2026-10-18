'use client';
import { parseSentence } from '@/lib/markup';

/**
 * 問題文。対象（[ ]）に赤の 5px 下線。
 * hideTargetRuby: よみ問題では対象のふりがなを出さない。
 * okuri: おくりがな問題の [ひか(る)] を「ひかる」として表示する。
 */
export function Sentence({ src, hideTargetRuby = true }: { src: string; hideTargetRuby?: boolean }) {
  const segs = parseSentence(src.replace(/\[([^\]]*)\]/g, (_, t: string) => `[${t.replace(/[()]/g, '')}]`));
  return (
    <div className="font-klee text-[clamp(40px,5.5vw,64px)] leading-[1.6]">
      {segs.map((s, i) => {
        const inner = s.tokens.map((t, j) =>
          t.t === 'text' ? <span key={j}>{t.s}</span> : s.target && hideTargetRuby ? <span key={j}>{t.base}</span> : (
            <ruby key={j}>{t.base}<rt>{t.rt}</rt></ruby>
          ),
        );
        return s.target ? <span key={i} className="border-b-[5px] border-primary">{inner}</span> : <span key={i}>{inner}</span>;
      })}
    </div>
  );
}
