'use client';
// 相棒のイラスト。進化の段階に合った絵を、背景なしで表示する。
// 絵は public/partners/<fire|wood|light>-<1..5>.png（scripts/cut-partners.ts で作る）。
// HAS_PARTNER_ART を false にすると、見本のプレースホルダー（文字だけ）に戻る。
import { PARTNERS, type PartnerId } from '@/lib/partners';

const HAS_PARTNER_ART = true;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type Props = { id: PartnerId; size: number; stage?: number; label?: string; dashed?: 2 | 3; fontSize?: number };

export function PartnerAvatar({ id, size, stage = 1, label, dashed = 3, fontSize = 14 }: Props) {
  const p = PARTNERS[id];
  if (HAS_PARTNER_ART) {
    // 絵があるときは、丸い枠・斜線の地なしで絵だけを出す
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${BASE}/partners/${id}-${stage}.png`}
        alt={`${p.name}（しんか ${stage}）`}
        draggable={false}
        className="pointer-events-none flex-none select-none"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full text-center"
      style={{ width: size, height: size, border: `${dashed}px dashed ${p.color}`, background: p.tint, color: p.color, fontSize, whiteSpace: 'pre-line' }}
    >
      {label ?? p.name}
    </div>
  );
}
