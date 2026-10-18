'use client';
import { useRouter } from 'next/navigation';
import { BackBtn, Card, Mk, Screen, Stars } from '@/components/ui';
import { useAppData } from '@/lib/hooks';
import { STAGE_COUNT, STAGE_NAMES, stageKanji } from '@/lib/data';
import { MODES, type Mode } from '@/lib/db';
import { bossUnlocked } from '@/lib/progress';
import { bossSet, stageSet } from '@/lib/quiz';
import { useGame } from '@/lib/game';
import { sfx } from '@/lib/sfx';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// アイコンは public/modes/<モード>.png（Gemini で作った絵を scripts/cut-sheets.ts で切り出し）
const MODE_CARDS: Record<Mode, { title: string; desc: string }> = {
  read: { title: 'よみ', desc: 'かんじの よみかたを ひらがなで かこう' },
  write: { title: 'かき', desc: 'ひらがなを かんじで かこう' },
  stroke: { title: 'かきじゅん・かくすう', desc: 'なんばんめに かく？ ぜんぶで なんかく？' },
  okuri: { title: 'おくりがな', desc: 'かんじの あとに つづく ひらがな' },
};

export function StageScreen({ stage }: { stage: number }) {
  const d = useAppData();
  const router = useRouter();
  const startSet = useGame((s) => s.startSet);
  if (!d?.profile) return null;
  const stars = d.stageStars(stage);
  const unlocked = bossUnlocked(stars);
  const remainingModes = MODES.filter((m) => stars[m] < 1).length;
  const cleared = d.bossCleared(stage);

  const go = (mode: Mode | 'boss') => {
    sfx('tap');
    startSet(mode === 'boss' ? bossSet(stage) : stageSet(stage, mode));
    router.push('/play/');
  };

  const cardCls = 'press flex min-h-[150px] flex-col gap-2 rounded-[18px] border-[3px] border-ink p-[18px] text-left shadow-hard-5';

  return (
    <Screen label="03 モードせんたく" className="gap-[18px] pb-20 pt-4">
      <div className="flex items-center gap-[14px]">
        <BackBtn href="/home/" />
        <div className="flex flex-col">
          <div className="text-[15px] text-frame">ステージ {stage} / {STAGE_COUNT}</div>
          <div className="font-yusei text-[clamp(24px,3vw,32px)]"><Mk>{STAGE_NAMES[stage - 1]}</Mk></div>
        </div>
      </div>

      <Card shadow={0} className="flex flex-col gap-2.5 rounded-[18px] px-[18px] py-[14px]">
        <div className="text-base">このステージの かんじ（10<Mk>{'{字:じ}'}</Mk>）</div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(64px,1fr))' }}>
          {stageKanji(stage).map((k) => {
            const l = d.learnedSet.has(k.char);
            return (
              <div
                key={k.char}
                className="relative flex aspect-square items-center justify-center rounded-xl border-2 border-ink font-klee text-4xl"
                style={{ background: l ? '#fff7e2' : 'rgba(255,247,226,.4)', color: l ? '#3a2614' : '#b59a72' }}
              >{k.char}</div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {MODES.map((m) => {
          const c = MODE_CARDS[m];
          return (
            <button key={m} className={`${cardCls} bg-card text-ink`} onClick={() => go(m)}>
              <div className="flex w-full items-center justify-between gap-2">
                <div className="font-yusei text-[28px]">{c.title}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${BASE}/modes/${m}.png`} alt="" className="-my-2 h-14 w-14 flex-none" />
              </div>
              <div className="text-[15px] opacity-90">{c.desc}</div>
              <div className="flex-1" />
              <Stars n={stars[m]} />
            </button>
          );
        })}
        <button className={`${cardCls} bg-boss text-paper disabled:cursor-default`} onClick={() => go('boss')} disabled={!unlocked}>
          <div className="flex w-full items-center justify-between gap-2">
            <div className="font-yusei text-[28px]">ボスせん</div>
            {/* このステージのボス */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/bosses/stage-${stage}.png`} alt="" className="-my-3 h-[72px] w-[72px]" />
          </div>
          <div className="text-[15px] opacity-90">ぜんぶの もんだいが まざって でるよ</div>
          <div className="flex-1" />
          <div className="text-[22px] text-paper">
            {cleared ? 'クリア！' : unlocked ? 'ちょうせん できる！' : `のこり ${remainingModes}モード`}
          </div>
        </button>
      </div>
    </Screen>
  );
}
