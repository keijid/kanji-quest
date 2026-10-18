'use client';
// レベルが上がったら お祝いを出す。知らせた レベルは meta.seenLevel に のこす（ほかの端末でも 2回は出さない）
import { useEffect } from 'react';
import { Btn, Mk, Modal } from '@/components/ui';
import { PartnerAvatar } from '@/components/Partner';
import { db, getMeta } from '@/lib/db';
import { useAppData } from '@/lib/hooks';
import { titleOf, titleRank } from '@/lib/progress';
import { sfx } from '@/lib/sfx';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

async function saveSeen(level: number) {
  const m = await getMeta();
  await db.meta.put({ ...m, seenLevel: level });
}

/** blocked のあいだは出さない（しんか の お祝いを 先に見せるときなど） */
export function LevelUp({ blocked = false }: { blocked?: boolean }) {
  const d = useAppData();
  const seen = d?.meta.seenLevel;
  const level = d?.level ?? 0;
  const show = !!d && seen !== undefined && level > seen && !blocked;

  // はじめて この機能が入ったときは、今の レベルを 知らせずみにする
  useEffect(() => { if (d && seen === undefined) void saveSeen(level); }, [d, seen, level]);
  useEffect(() => { if (show) sfx('levelUp'); }, [show]);

  if (!show || !d?.profile) return null;
  const newTitle = titleRank(level) > titleRank(seen!);
  return (
    <Modal>
      <div className="font-yusei text-[44px] text-primary">レベルアップ！</div>
      <div className="flex items-center gap-3 font-yusei text-[28px]">
        <span className="text-frame">Lv.{seen}</span>
        <span className="text-frame">→</span>
        <span className="animate-poyon text-[48px] text-primary">Lv.{level}</span>
      </div>
      {newTitle ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE}/badges/badge-${titleRank(level)}.png`} alt="" className="animate-poyon h-28 w-28" />
          <div className="text-center text-lg"><Mk>{`あたらしい しょうごう「${titleOf(level)}」を もらったよ！`}</Mk></div>
        </>
      ) : (
        <>
          <PartnerAvatar id={d.profile.partner} stage={d.evo.stage} mood="happy" size={110} />
          <div className="text-center text-lg">この ちょうしで がんばろう！</div>
        </>
      )}
      <Btn tone="red" className="min-h-16 w-full font-yusei text-2xl" onClick={() => void saveSeen(level)}>やったね！</Btn>
    </Modal>
  );
}
