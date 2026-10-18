'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Btn, Card, Mk } from '@/components/ui';
import { PartnerAvatar } from '@/components/Partner';
import { useAppData } from '@/lib/hooks';
import { stageKanji, TOTAL } from '@/lib/data';
import { AdventureMap } from '@/components/AdventureMap';
import { db, today } from '@/lib/db';
import { PARTNERS } from '@/lib/partners';
import { reviewSet } from '@/lib/quiz';
import { useGame } from '@/lib/game';
import { sfx } from '@/lib/sfx';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Home() {
  const d = useAppData();
  const router = useRouter();
  const startSet = useGame((s) => s.startSet);
  const startLesson = useGame((s) => s.startLesson);
  const todaySec = useLiveQuery(async () => (await db.days.get(today()))?.seconds ?? 0, []);
  if (!d?.profile) return null;
  const p = PARTNERS[d.profile.partner];
  const cur = d.current;
  const overLimit = todaySec !== undefined && todaySec >= d.meta.settings.limitMin * 60;

  return (
    <div data-screen-label="02 ホーム" className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b-[3px] border-dashed border-dash px-[clamp(16px,2.4vw,28px)] py-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE}/icons/icon-192.png`} alt="" width={58} height={58} className="h-[58px] w-[58px] flex-none rounded-[14px] border-2 border-ink" />
          <h1 className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/title.png`} alt="カンジクエスト" className="block h-[clamp(32px,4.2vw,46px)] w-auto" />
          </h1>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-2.5 text-[17px]">
          <div className="flex items-center gap-1.5 rounded-[10px] border-2 border-ink bg-card px-3.5 py-1.5">
            <span className="text-xl text-primary">{d.streak}</span>にち れんぞく
          </div>
          <div className="flex items-center gap-1.5 rounded-[10px] border-2 border-ink bg-card py-1 pl-2 pr-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/badges/badge-${d.titleRank}.png`} alt="" className="-my-1 h-8 w-8" />
            <span>Lv.{d.level} <Mk>{d.title}</Mk></span>
          </div>
          <Link href="/parent/" onClick={() => sfx('tap')} className="flex min-h-11 items-center rounded-[10px] border-2 border-ink bg-card px-3 py-1.5 text-sm text-ink no-underline">
            <Mk>{'おうちの{人:ひと}'}</Mk>
          </Link>
        </div>
      </header>

      {overLimit && (
        <div className="mx-[clamp(16px,2.4vw,28px)] mt-3 rounded-[14px] border-2 border-dashed border-gold bg-hint px-4 py-2 text-[17px]">
          きょうは たくさん がんばったね。そろそろ ひと やすみ しよう！
        </div>
      )}

      <div className="flex flex-1 flex-wrap gap-5 px-[clamp(16px,2.4vw,28px)] pt-[18px]">
        <main className="relative min-h-[380px] flex-[1_1_520px] overflow-hidden rounded-[18px] border-[3px] border-ink bg-map">
          <AdventureMap current={cur} practiced={d.practicedSet} bossCleared={d.bossCleared} />
        </main>

        <aside className="flex max-w-full flex-[1_1_280px] flex-col gap-[14px]">
          <Card className="flex flex-col items-center gap-2.5 rounded-[18px] p-4">
            <PartnerAvatar id={d.profile.partner} size={140} stage={d.evo.stage} label={`${p.kind}\nしんか ${d.evo.stage}`} />
            <div className="font-yusei text-[26px]">{p.name}</div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 w-6 rounded-full border-2 border-ink" style={{ background: i <= d.evo.stage ? p.color : undefined }} />
              ))}
            </div>
            <div className="text-[15px]">
              {d.evo.final ? (
                d.evo.remaining === 0 ? 'ぜんぶ おぼえた！ さいこうの あいぼう！' : <>ぜんぶまで あと <span className="text-[22px] text-primary">{d.evo.remaining}</span><Mk>{'{字:じ}'}</Mk>！</>
              ) : (
                <>あと <span className="text-[22px] text-primary">{d.evo.remaining}</span><Mk>{'{字:じ}おぼえると しんか！'}</Mk></>
              )}
            </div>
          </Card>
          <Card className="flex flex-col gap-2 rounded-[18px] px-4 py-[14px]">
            <div className="text-base"><Mk>{'{合格:ごうかく}よそう'}</Mk></div>
            <div className="h-5 overflow-hidden rounded-[10px] border-2 border-ink bg-paper">
              <div className="gauge-stripe h-full" style={{ width: `${d.prediction}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span>おぼえた {d.learned}/{TOTAL}<Mk>{'{字:じ}'}</Mk></span>
              <span className="text-primary">{d.prediction}%</span>
            </div>
          </Card>
        </aside>
      </div>

      <footer className="grid gap-[14px] px-[clamp(16px,2.4vw,28px)] pb-[22px] pt-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        <Btn
          tone="red"
          shadow={5}
          className="min-h-[76px] font-yusei text-[28px]"
          onClick={() => {
            // つぎに練習する字の「おぼえよう」へ。10字とも練習ずみならステージ画面（ボスせん）へ
            const next = stageKanji(cur).map((k) => k.char).find((c) => !d.practicedSet.has(c));
            if (next) { startLesson(next); router.push('/lesson/'); } else router.push(`/stage/${cur}/`);
          }}
        >ぼうけんへ！</Btn>
        <Btn
          shadow={5}
          className="min-h-[76px] text-lg"
          disabled={d.weak.length === 0}
          onClick={() => { startSet(reviewSet(d.weak)); router.push('/play/'); }}
        >
          ふくしゅう
          <div className="text-[13px] text-primary">{d.weak.length ? <>にがて {d.weak.length}<Mk>{'{字:じ}'}</Mk></> : 'にがて なし'}</div>
        </Btn>
        <Btn shadow={5} className="min-h-[76px] text-lg" onClick={() => router.push('/zukan/')}>
          かんじずかん<div className="text-[13px] text-frame">{TOTAL}<Mk>{'{字:じ}'}</Mk></div>
        </Btn>
        <Btn shadow={5} className="min-h-[76px] text-lg" onClick={() => router.push('/mock/')}>
          もぎテスト<div className="text-[13px] text-frame">ほんばん・ミニ</div>
        </Btn>
      </footer>
    </div>
  );
}
