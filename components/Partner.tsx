'use client';
// 相棒のイラスト。見本どおりの点線の丸（斜線の地）の中に、進化の段階に合った絵を置く。
// 絵は public/partners/<fire|wood|light>-<1..5>.png（scripts/cut-partners.ts で作る）。
// HAS_PARTNER_ART を false にすると、見本のプレースホルダー（文字だけ）に戻る。
import { PARTNERS, type PartnerId } from '@/lib/partners';

const HAS_PARTNER_ART = true;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type Props = { id: PartnerId; size: number; stage?: number; label?: string; dashed?: 2 | 3; fontSize?: number };

export function PartnerAvatar({ id, size, stage = 1, label, dashed = 3, fontSize = 14 }: Props) {
  const p = PARTNERS[id];
  return (
    <div
      className="relative flex flex-none items-center justify-center rounded-full text-center"
      style={{ width: size, height: size, border: `${dashed}px dashed ${p.color}`, background: p.tint, color: p.color, fontSize, whiteSpace: 'pre-line' }}
    >
      {HAS_PARTNER_ART ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${BASE}/partners/${id}-${stage}.png`}
          alt={`${p.name}（しんか ${stage}）`}
          draggable={false}
          className="pointer-events-none select-none"
          style={{ width: '92%', height: '92%', objectFit: 'contain' }}
        />
      ) : (label ?? p.name)}
    </div>
  );
}
