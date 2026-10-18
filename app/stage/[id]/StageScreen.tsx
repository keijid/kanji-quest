'use client';
// 03 ステージ：10字を1字ずつ順番に練習 → 全部おわったらボスせん。下に「まとめて れんしゅう」（モード別・じゆう）
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
  const startLesson = useGame((s) => s.startLesson);
  if (!d?.profile) return null;

  const chars = stageKanji(stage).map((k) => k.char);
  const open = stage <= d.current; // このステージに来られるか
  // つぎに練習する字（順番に開く）。前のステージは全部開いている
  const nextIdx = chars.findIndex((c) => !d.practicedSet.has(c));
  const remaining = chars.filter((c) => !d.practicedSet.has(c)).length;
  const unlocked = open && bossUnlocked(stage, d.practicedSet);
  const cleared = d.bossCleared(stage);
  const stars = d.stageStars(stage);
  const bossCount = bossSet(stage).questions.length;

  const lesson = (c: string) => { sfx('tap'); startLesson(c); router.push('/lesson/'); };
  const go = (mode: Mode | 'boss') => {
    sfx('tap');
    startSet(mode === 'boss' ? bossSet(stage) : stageSet(stage, mode));
    router.push('/play/');
  };

  const cardCls = 'press flex flex-col gap-2 rounded-[18px] border-[3px] border-ink p-[18px] text-left shadow-hard-5';

  return (
    <Screen label="03 ステージ" className="gap-[18px] pb-20 pt-4">
      <div className="flex items-center gap-[14px]">
        <BackBtn href="/home/" />
        <div className="flex flex-col">
          <div className="text-[15px] text-frame">ステージ {stage} / {STAGE_COUNT}</div>
          <div className="font-yusei text-[clamp(24px,3vw,32px)]"><Mk>{STAGE_NAMES[stage - 1]}</Mk></div>
        </div>
      </div>

      <Card shadow={0} className="flex flex-col gap-2.5 rounded-[18px] px-[18px] py-[14px]">
        <div className="text-base">1<Mk>{'{字:じ}'}</Mk>ずつ れんしゅう しよう（10<Mk>{'{字:じ}'}</Mk>）</div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(64px,1fr))' }}>
          {chars.map((c, i) => {
            const done = d.practicedSet.has(c);
            const isNext = open && i === nextIdx;
            const available = open && (done || i <= nextIdx || nextIdx < 0);
            return (
              <button
                key={c}
                disabled={!available}
                onClick={() => lesson(c)}
                aria-label={`${c}${done ? '（れんしゅうずみ）' : isNext ? '（つぎ）' : ''}`}
                className="press relative flex aspect-square items-center justify-center rounded-xl font-klee text-4xl disabled:cursor-default"
                style={{
                  border: isNext ? '3px solid #b8321f' : `2px ${available ? 'solid #3a2614' : 'dashed #c9a46a'}`,
                  background: isNext ? '#fff' : available ? '#fff7e2' : 'rgba(255,247,226,.4)',
                  color: available ? '#3a2614' : '#b59a72',
                }}
              >
                {c}
                {done && <span className="absolute -right-1 -top-1 text-[18px] leading-none text-gold drop-shadow-[1px_1px_0_#3a2614]">★</span>}
                {isNext && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-primary px-1.5 font-kiwi text-[11px] leading-[18px] text-paper">つぎ</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <button className={`${cardCls} min-h-[120px] bg-boss text-paper disabled:cursor-default disabled:opacity-80`} onClick={() => go('boss')} disabled={!unlocked}>
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="font-yusei text-[28px]">ボスせん</div>
            <div className="text-[15px] opacity-90">10<Mk>{'{字:じ}'}</Mk>の よみ（おくりがな）・かき・かきじゅんを ぜんぶ ためすよ（{bossCount}もん）</div>
          </div>
          {/* このステージのボス */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE}/bosses/stage-${stage}.png`} alt="" className="-my-3 h-[88px] w-[88px] flex-none" />
        </div>
        <div className="text-[20px]">
          {cleared ? 'クリア！ もう いちど ちょうせん できるよ' : unlocked ? 'ちょうせん できる！ 8わり せいかいで クリア' : `あと ${remaining}じ れんしゅう すると ちょうせん できる`}
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-2.5">
          <div className="text-base text-frame">まとめて れんしゅう（すきな ときに）</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            {MODES.map((m) => {
              const c = MODE_CARDS[m];
              return (
                <button key={m} className={`${cardCls} min-h-[110px] bg-card text-ink`} onClick={() => go(m)}>
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="font-yusei text-[22px]">{c.title}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${BASE}/modes/${m}.png`} alt="" className="-my-2 h-12 w-12 flex-none" />
                  </div>
                  <div className="text-[14px] opacity-90">{c.desc}</div>
                  <div className="flex-1" />
                  <Stars n={stars[m]} size={18} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Screen>
  );
}
