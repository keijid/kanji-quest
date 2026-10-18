'use client';
// 相棒のイラスト。今は見本どおりの斜線の丸（プレースホルダー）。
// public/partners/<fire|wood|light>-<1..5>.png を置き、HAS_PARTNER_ART を true にすると画像に差し替わる。
import { PARTNERS, type PartnerId } from '@/lib/partners';

const HAS_PARTNER_ART = false;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type Props = { id: PartnerId; size: number; stage?: number; label?: string; dashed?: 2 | 3; fontSize?: number };

export function PartnerAvatar({ id, size, stage = 1, label, dashed = 3, fontSize = 14 }: Props) {
  const p = PARTNERS[id];
  if (HAS_PARTNER_ART) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${BASE}/partners/${id}-${stage}.png`} alt={`${p.name}（しんか ${stage}）`} width={size} height={size} style={{ width: size, height: size, flex: 'none' }} />;
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
