'use client';
// 07 5かい れんしゅう：書きじゅんの お手本（アニメ）を「見て写す」。なぞりはなし。
// 1回ずつ 手書き判定する（字の形が お手本の字と みとめられ、画数も ほぼ足りているときだけ「できた」）
// 1字ずつの練習では、おぼえよう → ここで5回 → その字の もんだい の じゅんに進む
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackBtn, Btn, Card, Mk, Modal } from '@/components/ui';
import { HandwritingPad, type PadHandle } from '@/components/HandwritingPad';
import { useGame } from '@/lib/game';
import { kanjiOf, kanjiReadingText } from '@/lib/data';
import { StrokeSvg, KANJIVG_CREDIT } from '@/components/StrokeSvg';
import { lessonSet } from '@/lib/quiz';
import { addXp, XP } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { judgeCopy } from '@/lib/recognize';

const TIMES = 5;

export default function Practice() {
  const router = useRouter();
  const practice = useGame((s) => s.practice);
  const endPractice = useGame((s) => s.endPractice);
  const startSet = useGame((s) => s.startSet);
  const [ci, setCi] = useState(0);
  const [done, setDone] = useState(0);
  const [filled, setFilled] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  /** いま書いたものが お手本と ちがったとき */
  const [retry, setRetry] = useState(false);
  const pads = useRef<(PadHandle | null)[]>([]);
  const [play, setPlay] = useState(1);

  const total = practice ? kanjiOf(practice.chars[ci]).strokes : 0;
  // 書きじゅんアニメ（800ms/画で くり返す。さいごは 少し長めに止める）
  useEffect(() => {
    if (!total) return;
    setPlay(1);
    const id = setInterval(() => setPlay((p) => (p >= total + 2 ? 1 : p + 1)), 800);
    return () => clearInterval(id);
  }, [total, ci]);

  // 自分で 画面を 出ていくときは、practice を消しても ホームへは 飛ばさない
  const leaving = useRef(false);
  useEffect(() => { if (!leaving.current && !useGame.getState().practice) router.replace('/home/'); }, [practice, router]);
  if (!practice) return null;

  const chars = practice.chars;
  const k = kanjiOf(chars[ci]);
  const rd = kanjiReadingText(k);
  const back = () => { leaving.current = true; const to = practice.returnTo; endPractice(); router.replace(to); };
  const toLesson = practice.then === 'lesson';
  /** 書きおわったあと：1字ずつの練習なら その字の もんだいへ、ほかは 戻り先へ */
  const next = () => {
    if (!toLesson) return back();
    const c = practice.chars[0];
    leaving.current = true;
    endPractice();
    startSet(lessonSet(c));
    router.replace('/play/');
  };

  const wrote = async () => {
    const s = pads.current[done]?.strokes() ?? [];
    setBusy(true);
    // 判定は少し重いので、ボタンの見た目が変わってから行う
    await new Promise((r) => setTimeout(r, 30));
    const ok = judgeCopy(s, k.char);
    setBusy(false);
    if (!ok) {
      sfx('hint');
      setRetry(true);
      clear();
      return;
    }
    setRetry(false);
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
        {/* 何字か まとめて 練習する ときだけ、いま 何字目かを 出す */}
        {chars.length > 1 && <div className="text-lg">{ci + 1} / {chars.length} <Mk>文字</Mk></div>}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-5">
        <Card className="mx-auto flex flex-[0_1_300px] flex-col items-center gap-2.5 rounded-[20px] p-[18px]">
          <div className="text-base text-frame"><Mk>お手本（書きじゅん）</Mk></div>
          <div className="relative h-[220px] w-[220px] rounded-xl border-[3px] border-ink bg-cell p-3">
            <div className="cell-guide" style={{ ['--g' as string]: 'rgba(184,50,31,.18)' }} />
            <StrokeSvg char={k.char} play={play > total ? 0 : play} />
          </div>
          <div className="text-base">
            {play > total ? <>ぜんぶで <b className="text-primary">{total}</b> <Mk>画</Mk></> : <><Mk>今</Mk> <b className="text-primary">{Math.min(play, total)}</b> <Mk>画目</Mk></>}
          </div>
          <div className="text-base">{rd.on} ／ {rd.kun}</div>
          <div className="text-[15px] text-frame">{k.strokes}<Mk>画</Mk> ・ <Mk>{k.words.slice(0, 2).join('、')}</Mk></div>
          <div className="text-xs text-frame">{KANJIVG_CREDIT}</div>
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
          {retry && (
            <div className="animate-pop-in rounded-[14px] border-2 border-dashed border-gold bg-hint px-4 py-2.5 text-[17px]">
              <Mk>{`おしい！ お手本の 書きじゅんを よく 見て、もう一回 書こう（${k.strokes}画）`}</Mk>
            </div>
          )}
          <div className="flex gap-3">
            <Btn className="min-h-[68px] flex-1 text-xl" onClick={clear}>けす</Btn>
            <Btn tone="green" className="min-h-[68px] flex-[2] font-yusei text-[26px]" onClick={wrote} disabled={!filled || busy}><Mk>{busy ? '見ているよ…' : '書けた！'}</Mk></Btn>
          </div>
        </div>
      </div>
      {finished && (
        <Modal>
          <div className="font-yusei text-5xl text-success">できた！</div>
          <div className="font-klee text-[56px] leading-none">{chars.join('')}</div>
          <div className="text-[17px] text-frame"><Mk>ぜんぶ 5回 書けたね</Mk> ＋{XP.practice * chars.length} けいけんち</div>
          <Btn tone="red" className="min-h-16 w-full font-yusei text-2xl" onClick={next}>{toLesson ? 'もんだいへ' : 'もどる'}</Btn>
        </Modal>
      )}
    </div>
  );
}
