// ボス（お父さん・お母さん）の 吹き出し。tail の 向きに ボスが いる。line を わたせば その せりふ（中ボス）
import { Mk } from './ui';
import { bossLine } from '@/lib/bossLines';

export function BossBubble({ stage = 0, line: given, happy, tail = 'right', className = '' }: { stage?: number; line?: string; happy: boolean; tail?: 'right' | 'bottom'; className?: string }) {
  const line = given ?? bossLine(stage, happy);
  if (!line) return null;
  const tailCls = tail === 'right'
    ? '-right-[9px] top-1/2 -translate-y-1/2 border-r-[3px] border-t-[3px]'
    : '-bottom-[9px] left-1/2 -translate-x-1/2 border-b-[3px] border-r-[3px]';
  return (
    <div
      className={`relative rounded-[18px] border-[3px] border-ink px-4 py-3 text-left font-kiwi text-[clamp(15px,1.8vw,19px)] leading-snug shadow-hard-4 ${happy ? 'bg-[#fff7e2] text-ink' : 'bg-paper text-primary'} ${className}`}
    >
      <Mk>{line}</Mk>
      <span className={`absolute h-4 w-4 rotate-45 ${happy ? 'bg-[#fff7e2]' : 'bg-paper'} border-ink ${tailCls}`} />
    </div>
  );
}
