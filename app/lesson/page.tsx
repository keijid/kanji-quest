'use client';
// 1字ずつの練習の入口「おぼえよう」：書き順アニメ・読み・ことばを見てから、その字だけの問題へ
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackBtn, Btn, Card, Mk } from '@/components/ui';
import { StrokeSvg, KANJIVG_CREDIT } from '@/components/StrokeSvg';
import { PartnerAvatar } from '@/components/Partner';
import { useAppData } from '@/lib/hooks';
import { LESSON_TIMES, useGame } from '@/lib/game';
import { kanjiOf, kanjiReadingText, STAGE_NAMES } from '@/lib/data';

export default function Lesson() {
  const router = useRouter();
  const d = useAppData();
  const char = useGame((s) => s.lesson);
  const startPractice = useGame((s) => s.startPractice);
  const [play, setPlay] = useState(1);

  // 最初の描画はサーバー側の初期値（null）なので、実際の値を見てから判断する
  useEffect(() => { if (!useGame.getState().lesson) router.replace('/home/'); }, [char, router]);

  const total = char ? kanjiOf(char).strokes : 0;
  // 書き順アニメ（800ms/画でくり返す。さいごは少し長めに止める）
  useEffect(() => {
    if (!total) return;
    const id = setInterval(() => setPlay((p) => (p >= total + 2 ? 1 : p + 1)), 800);
    return () => clearInterval(id);
  }, [total]);

  if (!char || !d?.profile) return null;
  const k = kanjiOf(char);
  const rd = kanjiReadingText(k);
  const shown = Math.min(play, total);

  return (
    <div data-screen-label="おぼえよう" className="flex flex-1 flex-col gap-4 px-[clamp(16px,2.4vw,28px)] pb-20 pt-4">
      <div className="flex items-center gap-[14px]">
        <BackBtn href="/home/" />
        <div className="flex flex-col">
          <div className="text-[15px] text-frame">ステージ {k.stage} ・ <Mk>{STAGE_NAMES[k.stage - 1]}</Mk></div>
          <div className="font-yusei text-[clamp(24px,3vw,32px)]">「{char}」を おぼえよう</div>
        </div>
      </div>
      <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
        <Card className="flex flex-[0_1_380px] flex-col items-center gap-3 rounded-[20px] p-[22px]">
          <div className="text-[17px] text-frame"><Mk>書きじゅん</Mk></div>
          <div className="relative aspect-square w-[min(100%,300px)] rounded-[14px] border-[3px] border-ink bg-cell p-3">
            <div className="cell-guide" style={{ ['--g' as string]: 'rgba(184,50,31,.18)' }} />
            <StrokeSvg char={char} play={play > total ? 0 : play} />
          </div>
          <div className="text-lg">
            {play > total ? <>ぜんぶで <b className="text-[22px] text-primary">{total}</b> <Mk>画</Mk></> : <><Mk>今</Mk> <b className="text-[22px] text-primary">{shown}</b> <Mk>画目</Mk></>}
          </div>
          <div className="text-xs text-frame">{KANJIVG_CREDIT}</div>
        </Card>
        <div className="flex max-w-[460px] flex-[1_1_340px] flex-col gap-4">
          <Card className="flex flex-col gap-3 rounded-[20px] p-[22px]">
            <div className="grid items-baseline gap-x-[14px] gap-y-2 text-lg" style={{ gridTemplateColumns: 'auto 1fr' }}>
              <div className="text-frame"><Mk>音読み</Mk></div><div>{rd.on}</div>
              <div className="text-frame"><Mk>くん読み</Mk></div><div>{rd.kun}</div>
              <div className="text-frame">ことば</div><div><Mk>{k.words.join('・')}</Mk></div>
            </div>
          </Card>
          <div className="flex items-center gap-3">
            <PartnerAvatar id={d.profile.partner} stage={d.evo.stage} mood="cheer" size={72} />
            <div className="text-[17px] leading-relaxed"><Mk>{`書きじゅんを よく 見てから、${LESSON_TIMES}回 書いて みよう！ そのあと もんだいに ちょうせん！`}</Mk></div>
          </div>
          <Btn tone="red" shadow={5} className="min-h-[72px] font-yusei text-[28px]" onClick={() => { startPractice([char], '/lesson/', 'lesson'); router.push('/practice/'); }}>はじめる</Btn>
        </div>
      </div>
    </div>
  );
}
