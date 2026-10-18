'use client';
// 共通部品。寸法・色・影はプロトタイプ（KanjiQuest.dc.html）の値そのまま
import Link from 'next/link';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { parseTokens } from '@/lib/markup';
import { sfx } from '@/lib/sfx';
import { autoRuby } from '@/lib/furi';

/** 記法つき文字列（{漢字:よみ}）を ruby 付きで表示する。記法のない かん字には lib/furi.ts の よみを つける */
export function Mk({ children }: { children: string }) {
  const tokens = parseTokens(children).flatMap((t) => (t.t === 'text' && !t.raw ? autoRuby(t.s) : [t]));
  return (
    <>
      {tokens.map((t, i) =>
        t.t === 'text' ? <span key={i}>{t.s}</span> : (
          <ruby key={i}>{t.base}<rt>{t.rt}</rt></ruby>
        ),
      )}
    </>
  );
}

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

type Tone = 'red' | 'green' | 'card' | 'blue';
const TONE: Record<Tone, string> = {
  red: 'bg-primary text-paper',
  green: 'bg-success text-paper',
  blue: 'bg-boss text-paper',
  card: 'bg-card text-ink',
};

/** 太枠＋ハード影のボタン */
export function Btn({ tone = 'card', shadow = 4, className, onClick, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; shadow?: 4 | 5 }) {
  return (
    <button
      {...p}
      onClick={(e) => { sfx('tap'); onClick?.(e); }}
      className={cx('press rounded-[16px] border-[3px] border-ink disabled:opacity-50', shadow === 5 ? 'shadow-hard-5' : 'shadow-hard-4', TONE[tone], className)}
    />
  );
}

/** 左上の「もどる / やめる」 56×56 */
export function BackBtn({ href, onClick, label = 'もどる' }: { href?: string; onClick?: () => void; label?: string }) {
  const cls = 'press flex h-14 min-w-14 items-center justify-center rounded-[14px] border-[3px] border-ink bg-card px-1 text-base no-underline text-ink';
  if (href) return <Link href={href} className={cls} onClick={() => sfx('tap')}>{label}</Link>;
  return <button className={cls} onClick={() => { sfx('tap'); onClick?.(); }}>{label}</button>;
}

export function Card({ className, children, style, shadow = 5 }: { className?: string; children: ReactNode; style?: CSSProperties; shadow?: 0 | 5 | 6 | 7 }) {
  const sh = shadow === 0 ? '' : shadow === 5 ? 'shadow-hard-5' : shadow === 6 ? 'shadow-hard-6' : 'shadow-hard-7';
  return <div className={cx('border-[3px] border-ink bg-card', sh, className)} style={style}>{children}</div>;
}

export function ProgressBar({ value, color = 'var(--color-success)', className, height = 18 }: { value: number; color?: string; className?: string; height?: number }) {
  return (
    <div className={cx('overflow-hidden border-2 border-ink bg-paper', className)} style={{ height, borderRadius: height / 2 }}>
      <div className="h-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

/** 画面の上の行（もどる・タイトル・進み具合） */
export function TopBar({ back, title, children }: { back: ReactNode; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-[14px]">
      {back}
      {title && <div className="font-yusei text-2xl">{title}</div>}
      {children}
    </div>
  );
}

/** 画面の外側の余白（左右 clamp(16px,2.4vw,28px)） */
export function Screen({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div data-screen-label={label} className={cx('flex flex-1 flex-col px-[clamp(16px,2.4vw,28px)]', className)}>
      {children}
    </div>
  );
}

export function Modal({ children }: { children: ReactNode }) {
  return (
    <div className="animate-pop-in absolute inset-0 z-10 flex items-center justify-center p-5" style={{ background: 'rgba(58,38,20,.45)' }}>
      <div className="animate-poyon flex w-full max-w-[440px] flex-col items-center gap-[14px] rounded-[24px] border-4 border-ink bg-card px-9 py-7 shadow-hard-8">
        {children}
      </div>
    </div>
  );
}

export function Stars({ n, size = 22, color = 'var(--color-gold)', off = 'var(--color-gold)' }: { n: number; size?: number; color?: string; off?: string }) {
  return (
    <div className="flex gap-1" style={{ fontSize: size, color, lineHeight: 1 }} aria-label={`ほし ${n}`}>
      {[0, 1, 2].map((i) => <span key={i} style={{ color: i < n ? color : off }}>{i < n ? '★' : '☆'}</span>)}
    </div>
  );
}

export { cx };
