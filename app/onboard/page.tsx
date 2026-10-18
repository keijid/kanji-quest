'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Mk } from '@/components/ui';
import { PartnerAvatar } from '@/components/Partner';
import { db, DEFAULT_META } from '@/lib/db';
import { PARTNER_IDS, PARTNERS, type PartnerId } from '@/lib/partners';
import { touchDay } from '@/lib/progress';

export default function Onboard() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [partner, setPartner] = useState<PartnerId>('fire');

  const start = async () => {
    await db.profile.put({ id: 'me', name: name.trim() || 'ゆうしゃ', partner, createdAt: Date.now() });
    if (!(await db.meta.get('main'))) await db.meta.put(DEFAULT_META);
    await touchDay();
    router.replace('/home/');
  };

  return (
    <div data-screen-label="01 はじめて" className="flex flex-1 flex-col items-center justify-center gap-7 px-5 py-8">
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="text-center font-yusei text-[clamp(28px,4vw,40px)] font-normal"><Mk>{'ようこそ、{冒険:ぼうけん}の{世界:せかい}へ！'}</Mk></h1>
        <div className="text-lg text-frame">いっしょに たびをする あいぼうを えらんでね</div>
      </div>
      <label className="flex w-full max-w-[420px] flex-col items-center gap-2">
        <span className="text-base">きみの なまえ</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="なまえを いれてね"
          maxLength={12}
          className="h-[60px] w-full rounded-[14px] border-[3px] border-ink bg-card text-center font-kiwi text-2xl text-ink outline-none placeholder:text-muted"
        />
      </label>
      <div className="flex w-full max-w-[900px] flex-wrap justify-center gap-5">
        {PARTNER_IDS.map((id) => {
          const p = PARTNERS[id];
          const on = partner === id;
          return (
            <button
              key={id}
              onClick={() => setPartner(id)}
              aria-pressed={on}
              className="flex max-w-[280px] flex-[1_1_220px] flex-col items-center gap-2.5 rounded-[20px] border-[3px] border-ink p-5 transition-transform duration-150"
              style={{ background: on ? '#fff7e2' : 'rgba(255,247,226,.5)', boxShadow: on ? '6px 6px 0 #3a2614' : '0 0 0 #3a2614', transform: on ? 'translateY(-6px)' : 'none' }}
            >
              <PartnerAvatar id={id} size={150} label={`${p.kind}\nイラスト`} />
              <div className="font-yusei text-[28px]">{p.name}</div>
              <div className="rounded-full px-3 py-0.5 text-[15px] text-paper" style={{ background: p.color }}>{p.elem}</div>
            </button>
          );
        })}
      </div>
      <Btn tone="red" shadow={5} onClick={start} className="h-[72px] min-w-[280px] font-yusei text-[28px]">しゅっぱつ！</Btn>
    </div>
  );
}
