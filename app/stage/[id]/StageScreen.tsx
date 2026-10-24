'use client';
// 03 ステージ：10字を1字ずつ順番に練習 → 全部おわったらボスせん
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackBtn, Card, Mk, Screen } from '@/components/ui';
import { useAppData } from '@/lib/hooks';
import { STAGE_COUNT, STAGE_NAMES, stageKanji } from '@/lib/data';
import { bossUnlocked } from '@/lib/progress';
import { bossSet } from '@/lib/quiz';
import { useGame } from '@/lib/game';
import { preloadVoice, sfx, voice } from '@/lib/sfx';
import { LevelUp } from '@/components/LevelUp';
import { useMidBossGate } from '@/components/MidBossAmbush';
import { BossBubble } from '@/components/BossBubble';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function StageScreen({ stage }: { stage: number }) {
  const d = useAppData();
  const router = useRouter();
  const startSet = useGame((s) => s.startSet);
  const startLesson = useGame((s) => s.startLesson);
  const { gate, popup } = useMidBossGate(d);
  // ボスせんを えらんだら ボスが おこる（声は 先に 読みこんで おく）
  useEffect(() => { preloadVoice(`stage-${stage}-angry`); }, [stage]);
  if (!d?.profile) return null;

  const chars = stageKanji(stage).map((k) => k.char);
  const open = stage <= d.current; // このステージに来られるか
  // つぎに練習する字（順番に開く）。前のステージは全部開いている
  const nextIdx = chars.findIndex((c) => !d.practicedSet.has(c));
  const remaining = chars.filter((c) => !d.practicedSet.has(c)).length;
  const unlocked = open && bossUnlocked(stage, d.practicedSet);
  const cleared = d.bossCleared(stage);
  const bossCount = bossSet(stage).questions.length;

  // 中ボスが 待っていれば、字や ボスせんを えらんだ ときに あらわれる
  const lesson = (c: string) => { sfx('tap'); gate(stage, () => { startLesson(c); router.push('/lesson/'); }); };
  const boss = () => {
    sfx('tap');
    gate(stage, () => { voice(`stage-${stage}-angry`); startSet(bossSet(stage)); router.push('/play/'); });
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
        <div className="text-base"><Mk>1字ずつ れんしゅう しよう（10字）</Mk></div>
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
                {isNext && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-1.5 font-kiwi text-[11px] leading-[18px] text-paper">つぎ</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <button className={`${cardCls} min-h-[120px] bg-boss text-paper disabled:cursor-default disabled:opacity-80`} onClick={boss} disabled={!unlocked}>
        {/* 左に 説明、右に このステージの ボスを 大きく */}
        <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2">
            <div className="font-yusei text-[28px]">ボスせん</div>
            <div className="text-[15px] opacity-90"><Mk>{`10字の 読み（おくりがな）・書き・書きじゅんを ぜんぶ ためすよ（${bossCount}もん）`}</Mk></div>
            <div className="text-[20px]">
              <Mk>{cleared ? 'クリア！ もう一回 ちょうせん できるよ' : unlocked ? 'ちょうせん できる！ 8わり せいかいで クリア' : `あと ${remaining}字 れんしゅう すると ちょうせん できる`}</Mk>
            </div>
          </div>
          {/* たおしたら ニッコリ顔。吹き出しも おこる せりふ → ほめる せりふに かわる */}
          <div className="flex flex-none items-center gap-3 self-end sm:self-auto">
            <BossBubble stage={stage} happy={cleared} className="max-w-[min(42vw,300px)]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/bosses/stage-${stage}${cleared ? '-happy' : ''}.png`} alt="" className="-my-4 h-[190px] w-[190px] flex-none" />
          </div>
        </div>
      </button>

      <LevelUp />
      {popup}
    </Screen>
  );
}
