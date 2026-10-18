'use client';
// 07 5かい れんしゅう：お手本を「見て写す」。なぞりはなし、判定もなし（何も書いていないときは進めない）
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackBtn, Btn, Card, Mk, Modal } from '@/components/ui';
import { HandwritingPad, type PadHandle } from '@/components/HandwritingPad';
import { useGame } from '@/lib/game';
import { kanjiOf, kanjiReadingText } from '@/lib/data';
import { addXp, XP } from '@/lib/progress';
import { sfx } from '@/lib/sfx';

const TIMES = 5;

export default function Practice() {
  const router = useRouter();
  const practice = useGame((s) => s.practice);
  const endPractice = useGame((s) => s.endPractice);
  const [ci, setCi] = useState(0);
  const [done, setDone] = useState(0);
  const [filled, setFilled] = useState(false);
  const [finished, setFinished] = useState(false);
  const pads = useRef<(PadHandle | null)[]>([]);

  useEffect(() => { if (!useGame.getState().practice) router.replace('/home/'); }, [practice, router]);
  if (!practice) return null;

  const chars = practice.chars;
  const k = kanjiOf(chars[ci]);
  const rd = kanjiReadingText(k);
  const back = () => { const to = practice.returnTo; endPractice(); router.replace(to); };

  const wrote = async () => {
    sfx('correct');
    setFilled(false);
    if (done + 1 < TIMES) { setDone(done + 1); return; }
    await addXp(XP.practice);
    if (ci + 1 < chars.length) {
      pads.current.forEach((p) => p?.clear());
      setCi(ci + 1);
      setDone(0);
    } else {
      setDone(TIMES);
      setFinished(true);
    }
  };

  const clear = () => { pads.current[done]?.clear(); setFilled(false); };

  return (
    <div data-screen-label="07 5かいれんしゅう" className="flex flex-1 flex-col gap-4 px-[clamp(16px,2.4vw,28px)] pb-20 pt-4">
      <div className="flex items-center gap-[14px]">
        <BackBtn onClick={back} />
        <div className="font-yusei text-2xl"><Mk>5回 れんしゅう</Mk></div>
        <div className="flex-1" />
        <div className="text-lg">{ci + 1} / {chars.length} <Mk>文字</Mk></div>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-5">
        <Card className="mx-auto flex flex-[0_1_300px] flex-col items-center gap-2.5 rounded-[20px] p-[18px]">
          <div className="text-base text-frame"><Mk>お手本</Mk></div>
          <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border-[3px] border-ink bg-cell font-klee text-[170px] leading-none">{k.char}</div>
          <div className="text-base">{rd.on} ／ {rd.kun}</div>
          <div className="text-[15px] text-frame">{k.strokes}<Mk>画</Mk> ・ <Mk>{k.words.slice(0, 2).join('、')}</Mk></div>
        </Card>
        <div className="flex flex-[1_1_460px] flex-col gap-[14px]">
          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: TIMES }, (_, j) => {
              const st = j < done ? 'done' : j === done ? 'here' : 'todo';
              const border = st === 'done' ? '#5a8a3a' : st === 'here' ? '#b8321f' : '#3a2614';
              return (
                <div key={`${ci}-${j}`} className="flex flex-col items-center gap-1.5">
                  <HandwritingPad
                    ref={(h) => { pads.current[j] = h; }}
                    disabled={st !== 'here'}
                    onChange={(empty) => { if (st === 'here') setFilled(!empty); }}
                    className="aspect-square w-full rounded-xl border-[3px]"
                    style={{ borderColor: border, background: st === 'done' ? '#eef4dc' : '#fffdf4' }}
                  />
                  <div className="text-[15px]" style={{ color: border }}>{st === 'done' ? 'できた' : st === 'here' ? 'ここ' : j + 1}</div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3">
            <Btn className="min-h-[68px] flex-1 text-xl" onClick={clear}>けす</Btn>
            <Btn tone="green" className="min-h-[68px] flex-[2] font-yusei text-[26px]" onClick={wrote} disabled={!filled}><Mk>書けた！</Mk></Btn>
          </div>
        </div>
      </div>
      {finished && (
        <Modal>
          <div className="font-yusei text-5xl text-success">できた！</div>
          <div className="font-klee text-[56px] leading-none">{chars.join('')}</div>
          <div className="text-[17px] text-frame"><Mk>ぜんぶ 5回 書けたね</Mk> ＋{XP.practice * chars.length} けいけんち</div>
          <Btn tone="red" className="min-h-16 w-full font-yusei text-2xl" onClick={back}>もどる</Btn>
        </Modal>
      )}
    </div>
  );
}
