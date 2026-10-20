'use client';
// KanjiVG の SVG パス（viewBox 109×109）で漢字を描く
import { STROKES } from '@/lib/data';

type Props = {
  char: string;
  /** 赤くする画（0始まり）。太さ8 */
  highlight?: number;
  /** 赤く 光らせる 画（0始まり。れんしゅうで 書けていなかった 画） */
  marks?: number[];
  /** 書き順アニメの今の画（1始まり）。0 ならアニメなし */
  play?: number;
  className?: string;
};

export function StrokeSvg({ char, highlight, marks, play = 0, className }: Props) {
  const paths = STROKES[char] ?? [];
  return (
    <svg viewBox="0 0 109 109" className={className} style={{ width: '100%', height: '100%', display: 'block', position: 'relative' }} aria-label={char}>
      {paths.map((d, i) => {
        let color = '#3a2614', w = 5;
        if (play > 0) {
          color = i < play - 1 ? '#3a2614' : i === play - 1 ? '#b8321f' : '#e6d3ad';
          w = i === play - 1 ? 7 : 5;
        } else if (marks?.length) {
          color = marks.includes(i) ? '#b8321f' : '#e6d3ad';
          w = marks.includes(i) ? 8 : 5;
        } else if (i === highlight) {
          color = '#b8321f';
          w = 8;
        }
        return <path key={i} d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

// ライセンス名の とちゅうで 改行しないように、スペースは \u00a0、ハイフンの あとに \u2060（改行させない しるし）
export const KANJIVG_CREDIT = 'かきじゅんデータ：KanjiVG（CC\u00a0BY-\u2060SA\u00a03.0）';
