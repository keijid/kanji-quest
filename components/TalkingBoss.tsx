'use client';
// ボスの 絵。おすと その せりふを しゃべる（声は public/voice/。lib/bossLines.ts の bossVoice）
import type { CSSProperties } from 'react';
import { voice } from '@/lib/sfx';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function TalkingBoss({ img, say, label, className = '', imgClass = '', style }: {
  /** public/bosses/ の ファイル名（.png なし） */
  img: string;
  /** しゃべる 声（public/voice/ の ファイル名）。なければ おしても しゃべらない */
  say?: string;
  /** 読みあげ用（「〜の せりふを きく」） */
  label: string;
  className?: string;
  imgClass?: string;
  style?: CSSProperties;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  const pic = <img src={`${BASE}/bosses/${img}.png`} alt="" className={imgClass} style={style} />;
  if (!say) return <span className={className}>{pic}</span>;
  return (
    <button
      type="button"
      // 外側の ボタン（ボスせん・ずかんの えらぶ）には つたえない
      onClick={(e) => { e.stopPropagation(); voice(say); }}
      aria-label={`${label}の せりふを きく`}
      className={`press block cursor-pointer ${className}`}
    >
      {pic}
    </button>
  );
}
