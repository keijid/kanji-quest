'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackBtn, Btn, Card, Mk } from '@/components/ui';
import { useAppData } from '@/lib/hooks';
import { KANJI, kanjiOf, kanjiReadingText, STAGE_COUNT, STAGE_NAMES, TOTAL } from '@/lib/data';
import { MID_BOSSES } from '@/lib/midboss';
import type { AppData } from '@/lib/hooks';
import { useGame } from '@/lib/game';
import { sfx } from '@/lib/sfx';
import { LevelUp } from '@/components/LevelUp';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// 学習の対象は小2の160字だけなので、タブは「2ねん」と「にがて」。「ボス」は たおした ボスの ずかん
type Tab = 2 | 3 | 'boss';

/** ボスずかんの 1体：ステージの ボス（stage）か 中ボス（mid） */
type BossEntry = { key: string; img: string; title: string; sub: string; cleared: (d: AppData) => boolean };

/** 出てくる じゅんに ならべる（ステージ5 の ボスの あとに 中ボス1、のように） */
const BOSSES: BossEntry[] = Array.from({ length: STAGE_COUNT }, (_, i) => i + 1).flatMap((s) => {
  const stage: BossEntry = { key: `s${s}`, img: `stage-${s}`, title: STAGE_NAMES[s - 1], sub: `ステージ${s}の ボス`, cleared: (d) => d.bossCleared(s) };
  const mids = MID_BOSSES.filter((m) => m.after === s).map((m): BossEntry => ({ key: `m${m.id}`, img: `mid-${m.id}`, title: m.name, sub: '{中:ちゅう}ボス', cleared: (d) => d.midCleared(m.id) }));
  return [stage, ...mids];
});

export default function Zukan() {
  const router = useRouter();
  const d = useAppData();
  const startPractice = useGame((s) => s.startPractice);
  const [tab, setTab] = useState<Tab>(2);
  const [sel, setSel] = useState<string>(KANJI[0].char);
  const [bossSel, setBossSel] = useState<string | null>(null);
  if (!d?.profile) return null;
  const bossCount = BOSSES.filter((b) => b.cleared(d)).length;

  const list = tab === 3 ? d.weak : KANJI.map((k) => k.char);
  const k = kanjiOf(sel);
  const rd = kanjiReadingText(k);
  const weakSet = new Set(d.weak);
  const tabs: [Tab, string][] = [[2, `2年 ${TOTAL}`], [3, `にがて ${d.weak.length}`], ['boss', `ボス ${bossCount}/${BOSSES.length}`]];

  const pickTab = (t: Tab) => {
    sfx('tap');
    setTab(t);
    if (t === 'boss') return;
    const first = t === 3 ? d.weak[0] : KANJI[0].char;
    if (first) setSel(first);
  };

  return (
    <div data-screen-label="08 かんじずかん" className="flex flex-1 flex-col gap-4 px-[clamp(16px,2.4vw,28px)] pb-20 pt-4">
      <div className="flex flex-wrap items-center gap-[14px]">
        <BackBtn href="/home/" />
        <div className="font-yusei text-[clamp(24px,3vw,32px)]"><Mk>かん字ずかん</Mk></div>
        {tab !== 'boss' && <div className="text-base text-frame">あつめた {d.learned} / {TOTAL}</div>}
        <div className="flex-1" />
        <div className="flex gap-2">
          {tabs.map(([t, label]) => (
            <button
              key={t}
              onClick={() => pickTab(t)}
              className="min-h-12 rounded-xl border-[3px] border-ink px-[18px] text-[17px]"
              style={{ background: tab === t ? '#3a2614' : '#fff7e2', color: tab === t ? '#fbf0d4' : '#3a2614' }}
            ><Mk>{label}</Mk></button>
          ))}
        </div>
      </div>
      {tab === 'boss' ? <BossZukan d={d} sel={bossSel ?? BOSSES.find((b) => b.cleared(d))?.key ?? BOSSES[0].key} onSel={(k) => { sfx('tap'); setBossSel(k); }} /> : (
      <div className="flex flex-1 flex-wrap items-start gap-5">
        <div className="grid flex-[1_1_460px] gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(60px,1fr))' }}>
          {list.length === 0 && <div className="col-span-full py-10 text-center text-lg text-frame"><Mk>にがてな かん字は ないよ！</Mk></div>}
          {list.map((c) => {
            const on = sel === c, l = d.learnedSet.has(c);
            return (
              <button
                key={c}
                onClick={() => setSel(c)}
                className="relative aspect-square rounded-[10px] p-0 font-klee text-[32px]"
                style={{
                  border: on ? '3px solid #3a2614' : `2px solid ${l ? '#3a2614' : '#c9a46a'}`,
                  background: on ? '#3a2614' : l ? '#fffdf4' : 'rgba(255,247,226,.35)',
                  color: on ? '#fbf0d4' : l ? '#3a2614' : '#b59a72',
                }}
              >
                {c}
                {weakSet.has(c) && <span className="absolute right-[5px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <Card className="sticky top-4 flex flex-[1_1_300px] flex-col gap-[14px] rounded-[20px] p-[22px]">
          <div className="flex items-center gap-4">
            <div className="flex h-[130px] w-[130px] flex-none items-center justify-center rounded-[14px] border-[3px] border-ink bg-cell font-klee text-[100px] leading-none">{k.char}</div>
            <div className="flex flex-col gap-1.5">
              <div className="text-sm text-frame"><Mk>{`${k.grade}年生の かん字`}</Mk></div>
              <div className="text-[22px]"><Mk>{`${k.strokes}画`}</Mk></div>
              <div className="text-base">ぶしゅ：{k.radical}</div>
            </div>
          </div>
          <div className="grid items-baseline gap-x-[14px] gap-y-2 border-t-[3px] border-dashed border-dash pt-[14px] text-lg" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <div className="text-frame"><Mk>音読み</Mk></div><div>{rd.on}</div>
            <div className="text-frame"><Mk>くん読み</Mk></div><div>{rd.kun}</div>
            <div className="text-frame">ことば</div><div><Mk>{k.words.join('・')}</Mk></div>
          </div>
          <Btn tone="green" className="min-h-[60px] rounded-[14px] text-xl" onClick={() => { startPractice([k.char], '/zukan/'); router.push('/practice/'); }}><Mk>書いて れんしゅう</Mk></Btn>
        </Card>
      </div>
      )}
      <LevelUp />
    </div>
  );
}

/** ボスずかん：たおした ボスは ニッコリ顔、まだの ボスは 黒い シルエット。えらぶと おこった顔と ニッコリ顔を ならべて 見られる */
function BossZukan({ d, sel, onSel }: { d: AppData; sel: string; onSel: (key: string) => void }) {
  const b = BOSSES.find((x) => x.key === sel)!;
  const cleared = b.cleared(d);
  return (
    <div className="flex flex-1 flex-wrap items-start gap-5">
      <div className="grid flex-[1_1_460px] gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))' }}>
        {BOSSES.map((x) => {
          const on = x.key === sel, c = x.cleared(d);
          return (
            <button
              key={x.key}
              onClick={() => onSel(x.key)}
              aria-label={c ? x.title.replace(/\{([^:}]*):[^}]*\}/g, '$1') : 'まだ たおしていない ボス'}
              className="flex flex-col items-center rounded-[14px] p-1.5"
              style={{ border: on ? '3px solid #3a2614' : `2px solid ${c ? '#3a2614' : '#c9a46a'}`, background: on ? '#f3e2b8' : c ? '#fffdf4' : 'rgba(255,247,226,.35)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BASE}/bosses/${x.img}${c ? '-happy' : ''}.png`} alt="" className="aspect-square w-full" style={{ filter: c ? undefined : 'brightness(0) opacity(.35)' }} />
              <span className="text-xs text-frame"><Mk>{x.sub}</Mk></span>
            </button>
          );
        })}
      </div>
      <Card className="sticky top-4 flex flex-[1_1_300px] flex-col items-center gap-3 rounded-[20px] p-[22px]">
        <div className="text-sm text-frame"><Mk>{b.sub}</Mk></div>
        <div className="text-center font-yusei text-[24px]">{cleared ? <Mk>{b.title}</Mk> : '？？？'}</div>
        {cleared ? (
          <>
            <div className="flex w-full justify-center gap-2">
              {(['', '-happy'] as const).map((h) => (
                <div key={h} className="flex flex-1 flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${BASE}/bosses/${b.img}${h}.png`} alt="" className="aspect-square w-full max-w-[200px]" />
                  <span className="text-sm text-frame">{h ? 'たおしたあと' : 'たたかう まえ'}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border-2 border-ink bg-success px-3 text-paper">たおした！</div>
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/bosses/${b.img}.png`} alt="" className="aspect-square w-full max-w-[220px]" style={{ filter: 'brightness(0) opacity(.35)' }} />
            <div className="text-center text-base text-frame"><Mk>たおすと ここで 見られるよ</Mk></div>
          </>
        )}
      </Card>
    </div>
  );
}
