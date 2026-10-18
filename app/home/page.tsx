'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Btn, Card, Mk } from '@/components/ui';
import { PartnerAvatar } from '@/components/Partner';
import { useAppData } from '@/lib/hooks';
import { STAGE_COUNT, STAGE_NAMES, stageKanji } from '@/lib/data';
import { db, today } from '@/lib/db';
import { PARTNERS } from '@/lib/partners';
import { reviewSet } from '@/lib/quiz';
import { useGame } from '@/lib/game';
import { sfx } from '@/lib/sfx';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// マップ上の位置（見本どおり）。cur-2, cur-1, cur, cur+1, ボス
const SLOTS = [
  { x: 10, y: 72 },
  { x: 30, y: 46 },
  { x: 50, y: 62 },
  { x: 70, y: 36 },
];
const BOSS = { x: 86, y: 56 };

export default function Home() {
  const d = useAppData();
  const router = useRouter();
  const startSet = useGame((s) => s.startSet);
  const todaySec = useLiveQuery(async () => (await db.days.get(today()))?.seconds ?? 0, []);
  if (!d?.profile) return null;
  const p = PARTNERS[d.profile.partner];
  const cur = d.current;
  const stages = [cur - 2, cur - 1, cur, cur + 1];
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
          <div className="rounded-[10px] border-2 border-ink bg-card px-3.5 py-1.5">Lv.{d.level} <Mk>{d.title}</Mk></div>
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
        <main className="map-grid relative min-h-[380px] flex-[1_1_520px] overflow-hidden rounded-[18px] border-[3px] border-ink">
          <div className="absolute left-4 top-3 z-[1] rounded-lg border-2 border-ink bg-paper px-3 py-0.5 text-[19px]">
            ステージ {cur} / {STAGE_COUNT} ・ <Mk>{STAGE_NAMES[cur - 1]}</Mk>
          </div>
          {/* ノードの中心どうしを点線でつなぐ（ノードの下に描く）。今いるステージまでは濃い色、その先はうすい色 */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {(() => {
              const pts = stages
                .map((st, i) => ({ st, ...SLOTS[i] }))
                .filter((p) => p.st >= 1 && p.st <= STAGE_COUNT);
              const path = [...pts, { st: Infinity, ...BOSS }];
              return path.slice(1).map((p, i) => (
                <line
                  key={i}
                  x1={`${path[i].x}%`}
                  y1={`${path[i].y}%`}
                  x2={`${p.x}%`}
                  y2={`${p.y}%`}
                  stroke={p.st <= cur ? '#8a5a34' : '#c9a46a'}
                  strokeWidth={4}
                  strokeDasharray="10 8"
                />
              ));
            })()}
          </svg>
          {stages.map((s, i) => {
            if (s < 1 || s > STAGE_COUNT) return null;
            const { x, y } = SLOTS[i];
            const first = stageKanji(s)[0].char;
            if (s === cur) {
              return (
                <div key={s}>
                  <Link
                    href={`/stage/${s}/`}
                    onClick={() => sfx('tap')}
                    aria-label={`ステージ ${s}`}
                    className="press absolute flex h-[100px] w-[100px] items-center justify-center rounded-full border-4 border-ink bg-primary font-klee text-[50px] text-paper no-underline shadow-hard-6"
                    style={{ left: `calc(${x}% - 50px)`, top: `calc(${y}% - 50px)` }}
                  >{first}</Link>
                  <div className="absolute w-20 rounded-lg border-2 border-ink bg-paper text-center text-sm" style={{ left: `calc(${x}% - 40px)`, top: `calc(${y}% + 58px)` }}>いまここ</div>
                </div>
              );
            }
            if (s > cur) {
              return (
                <div key={s} className="absolute flex h-[66px] w-[66px] items-center justify-center rounded-full border-[3px] border-dashed border-frame text-2xl text-frame" style={{ left: `calc(${x}% - 33px)`, top: `calc(${y}% - 33px)`, background: '#f8ebc6' }}>？</div>
              );
            }
            return (
              <Link
                key={s}
                href={`/stage/${s}/`}
                onClick={() => sfx('tap')}
                aria-label={`ステージ ${s}`}
                className="absolute flex h-[66px] w-[66px] items-center justify-center rounded-full border-[3px] border-ink bg-card font-klee text-[34px] text-ink no-underline"
                style={{ left: `calc(${x}% - 33px)`, top: `calc(${y}% - 33px)` }}
              >{first}</Link>
            );
          })}
          <div className="absolute flex h-[84px] w-[84px] items-center justify-center border-[3px] border-ink bg-boss text-lg text-paper shadow-hard-5" style={{ left: `calc(${BOSS.x}% - 42px)`, top: `calc(${BOSS.y}% - 42px)`, transform: 'rotate(-4deg)' }}>ボス</div>
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
              <span>おぼえた {d.learned}/240<Mk>{'{字:じ}'}</Mk></span>
              <span className="text-primary">{d.prediction}%</span>
            </div>
          </Card>
        </aside>
      </div>

      <footer className="grid gap-[14px] px-[clamp(16px,2.4vw,28px)] pb-[22px] pt-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        <Btn tone="red" shadow={5} className="min-h-[76px] font-yusei text-[28px]" onClick={() => router.push(`/stage/${cur}/`)}>ぼうけんへ！</Btn>
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
          かんじずかん<div className="text-[13px] text-frame">240<Mk>{'{字:じ}'}</Mk></div>
        </Btn>
        <Btn shadow={5} className="min-h-[76px] text-lg" onClick={() => router.push('/mock/')}>
          もぎテスト<div className="text-[13px] text-frame">ほんばん・ミニ</div>
        </Btn>
      </footer>
    </div>
  );
}
