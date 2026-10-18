'use client';
import type { ReactNode } from 'react';
import { PartnerAvatar } from '@/components/Partner';
import type { PartnerId } from '@/lib/partners';

/** 相棒アイコン付きのヒント吹き出し（hint-bg, 2px dashed gold） */
export function HintBubble({ partner, stage, children, size = 56 }: { partner: PartnerId; stage: number; children: ReactNode; size?: number }) {
  return (
    <div className="animate-pop-in flex w-full items-center gap-3 rounded-[14px] border-2 border-dashed border-gold bg-hint px-[14px] py-3">
      <PartnerAvatar id={partner} stage={stage} size={size} dashed={2} fontSize={11} />
      <div className="text-lg leading-normal">{children}</div>
    </div>
  );
}
