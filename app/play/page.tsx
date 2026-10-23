'use client';
// 04 よみ / 05 かき / 05b かきじゅん / 05c おくりがな（ボスせん・中ボスせん・ふくしゅう も同じ画面）
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackBtn, Btn, Card, Mk, Modal, ProgressBar, Screen } from '@/components/ui';
import { StrokeSvg, KANJIVG_CREDIT } from '@/components/StrokeSvg';
import { WriteQ } from '@/components/play/WriteQ';
import { PartnerAvatar } from '@/components/Partner';
import { HintBubble } from '@/components/play/HintBubble';
import { useAppData } from '@/lib/hooks';
import { useGame } from '@/lib/game';
import { kanjiOf } from '@/lib/data';
import type { Outcome } from '@/lib/db';
import { hintFor } from '@/lib/hints';
import { clearBoss, clearMidBoss, markPracticed, recordAnswers, saveStageStars, starsFor, XP, type AnswerLog } from '@/lib/progress';
import type { Question, SetKind } from '@/lib/quiz';
import type { PartnerId } from '@/lib/partners';
import { sfx } from '@/lib/sfx';

const TITLE: Record<SetKind, string> = { read: '読み', write: '書き', stroke: '書きじゅん・画数', okuri: 'おくりがな', boss: 'ボスせん', midboss: '{中:ちゅう}ボスせん', review: 'ふくしゅう', lesson: 'れんしゅう' };
/** ボスせんの中の分野（おくりがなは「よみ」に入れる） */
const BOSS_PART: Record<Question['kind'], string> = { read: '読み', okuri: '読み', write: '書き', stroke: '書きじゅん' };
const LABEL: Record<Question['kind'], string> = { read: '04 よみ', write: '05 かき', stroke: '05b かきじゅん', okuri: '05c おくりがな' };

type Phase = 'ask' | 'hint' | 'correct' | 'reveal';

export default function Play() {
  const router = useRouter();
  const d = useAppData();
  const set = useGame((s) => s.set);
  const finishSet = useGame((s) => s.finishSet);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [logs, setLogs] = useState<AnswerLog[]>([]);
  const [saving, setSaving] = useState(false);
  const finishing = useRef(false);

  useEffect(() => { if (!useGame.getState().set && !finishing.current) router.replace('/home/'); }, [set, router]);
  if (!set || !d?.profile) return null;

  const q = set.questions[i];
  const total = set.questions.length;
  // 1字ずつの練習は、マップ（ホーム）から来るので、やめたらホームへ
  const backHref = set.kind === 'lesson' || !set.stage ? '/home/' : `/stage/${set.stage}/`;
  const title = set.kind === 'lesson' ? `「{${set.char}:}」の れんしゅう` : set.kind === 'boss' || set.kind === 'midboss' ? `${TITLE[set.kind]} ・ ${BOSS_PART[q.kind]}` : TITLE[set.kind];
  const last = i === total - 1;
  // ボスせん・中ボスせんでは、まちがえた字を にがてに 入れる
  const addWeak = set.kind === 'boss' || set.kind === 'midboss';

  /** 答えを出したとき。ok＝正解か */
  const answer = (ok: boolean) => {
    if (ok) {
      sfx('correct');
      setLogs((l) => [...l, { char: q.char, mode: q.kind, outcome: (phase === 'hint' ? 1 : 2) as Outcome }]);
      setPhase('correct');
    } else if (phase === 'ask' && q.kind !== 'stroke') {
      // 書きじゅんは えらぶ 問題で 2回目は あてずっぽうでも 当たるので、1回 まちがえたら 答えを 見せる
      sfx('hint');
      setPhase('hint');
    } else {
      sfx('wrong');
      setLogs((l) => [...l, { char: q.char, mode: q.kind, outcome: 0 }]);
      setPhase('reveal');
    }
  };

  const next = async () => {
    if (!last) {
      setI(i + 1);
      setPhase('ask');
      return;
    }
    setSaving(true);
    const correct = logs.filter((l) => l.outcome > 0).length;
    const stars = starsFor(correct, total);
    const learnedBefore = d.learned;
    const { newlyLearned } = await recordAnswers(logs, { addWeak });
    let bossCleared = false;
    if (set.stage && set.kind !== 'boss' && set.kind !== 'midboss' && set.kind !== 'review' && set.kind !== 'lesson') await saveStageStars(set.stage, set.kind, stars);
    // 1字ずつの練習は、さいごまでやれば練習ずみ（まちがえた字は ふくしゅう で身につける）
    if (set.kind === 'lesson' && set.char) await markPracticed(set.char);
    if (set.stage && set.kind === 'boss' && stars >= 2) { await clearBoss(set.stage); bossCleared = true; }
    if (set.mid && set.kind === 'midboss' && stars >= 2) { await clearMidBoss(set.mid); bossCleared = true; }
    sfx(bossCleared ? 'stageClear' : 'finish');
    finishing.current = true;
    finishSet({ set, logs, stars, newlyLearned, learnedBefore, learnedAfter: learnedBefore + newlyLearned.length, bossCleared });
    router.replace('/result/');
  };

  const outcome = logs[logs.length - 1]?.outcome;

  return (
    <Screen label={LABEL[q.kind]} className="gap-4 pb-20 pt-4">
      <div className="flex items-center gap-[14px]">
        <BackBtn href={backHref} label="やめる" />
        <div className="whitespace-nowrap font-yusei text-2xl"><Mk>{title}</Mk></div>
        <ProgressBar value={i / total} className="flex-1" />
        <div className="text-lg">{i + 1} / {total}</div>
      </div>

      {q.kind === 'stroke' ? (
        <StrokeQ key={i} q={q} partner={d.profile.partner} partnerStage={d.evo.stage} phase={phase} onAnswer={answer} />
      ) : (
        <WriteQ key={i} q={q} partner={d.profile.partner} partnerStage={d.evo.stage} hint={phase === 'hint'} onAnswer={answer} />
      )}

      {(phase === 'correct' || phase === 'reveal') && (
        <Modal>
          {/* 相棒の顔：せいかい＝よろこぶ、こたえを出すとき＝おどろく */}
          <div className="-mt-3 animate-poyon">
            <PartnerAvatar id={d.profile.partner} stage={d.evo.stage} mood={phase === 'correct' ? 'happy' : 'surprised'} size={110} />
          </div>
          {phase === 'correct' ? (
            <div className="font-yusei text-5xl text-success">せいかい！</div>
          ) : (
            <div className="font-yusei text-[40px] text-primary"><Mk>答えは これ！</Mk></div>
          )}
          {/* せいかいの ときは 答えを出さない（自分で書いたので） */}
          {phase === 'reveal' && <AnswerView q={q} />}
          <div className="text-center text-[17px] text-frame">
            {phase === 'reveal' ? <Mk>{addWeak ? 'にがての かん字に 入れたよ。ふくしゅうで もう一回！' : '答えを よく 見て おぼえよう！'}</Mk>
              : outcome === 1 ? <Mk>{`ヒントで せいかい ＋${XP.hint} けいけんち${addWeak ? '。にがての かん字に 入れたよ' : ''}`}</Mk> : `＋${XP.first} けいけんち`}
          </div>
          <Btn tone="red" className="min-h-16 w-full font-yusei text-2xl" onClick={next} disabled={saving}>
            <Mk>{last ? 'けっかを 見る' : 'つぎへ'}</Mk>
          </Btn>
        </Modal>
      )}
    </Screen>
  );
}

function AnswerView({ q }: { q: Question }) {
  const k = kanjiOf(q.char);
  switch (q.kind) {
    case 'read': return <div className="font-klee text-[40px]">{q.answer}</div>;
    case 'write': return <div className="font-klee text-[72px] leading-none">{q.char}</div>;
    case 'okuri': return <div className="font-klee text-[64px] leading-none">{q.char}<span className="text-primary">{q.okuri}</span></div>;
    case 'stroke':
      return (
        <>
          <div className="text-2xl"><Mk>{q.sub === 'nth' ? `「{${q.char}:}」の ${q.index + 1}画目` : `「{${q.char}:}」は ${k.strokes}画`}</Mk></div>
          {q.sub === 'nth' && <div className="text-[17px] text-frame"><Mk>{`ぜんぶで ${k.strokes}画 だよ`}</Mk></div>}
        </>
      );
  }
}

// ---- かきじゅん・かくすう ----
function StrokeQ({ q, partner, partnerStage, phase, onAnswer }: { q: Extract<Question, { kind: 'stroke' }>; partner: PartnerId; partnerStage: number; phase: Phase; onAnswer: (ok: boolean) => void }) {
  const total = kanjiOf(q.char).strokes;
  const [sel, setSel] = useState<number | null>(null);
  const [play, setPlay] = useState(0);
  const hint = phase === 'hint';
  const right = q.index + 1;

  // ヒント中は書き順アニメ（800ms/画でループ）
  useEffect(() => {
    if (!hint) { setPlay(0); return; }
    setPlay(1);
    const id = setInterval(() => setPlay((p) => (p >= total ? 1 : p + 1)), 800);
    return () => clearInterval(id);
  }, [hint, total]);

  const pick = (v: number) => {
    if (phase === 'correct' || phase === 'reveal') return;
    setSel(v);
    onAnswer(v === right);
  };

  return (
    <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
      <Card className="flex flex-[0_1_400px] flex-col items-center gap-[14px] rounded-[20px] p-[22px]">
        <div className="text-center text-[22px]">
          {q.sub === 'nth' ? <><span className="text-primary"><Mk>赤い ところ</Mk></span>は<br /><Mk>何画目に 書く？</Mk></> : <>ぜんぶで<br /><Mk>何画？</Mk></>}
        </div>
        <div className="relative aspect-square w-[min(100%,300px)] rounded-[14px] border-[3px] border-ink bg-cell p-3">
          <div className="cell-guide" style={{ ['--g' as string]: 'rgba(184,50,31,.18)' }} />
          <StrokeSvg char={q.char} highlight={q.sub === 'nth' ? q.index : undefined} play={hint ? play : 0} />
        </div>
        {hint && (
          <HintBubble partner={partner} stage={partnerStage} size={52}>
            <span className="text-[17px]"><Mk>{hintFor(q)}</Mk><br /><Mk>今</Mk> <b className="text-[22px] text-primary">{Math.min(play || 1, total)}</b> <Mk>画目</Mk></span>
          </HintBubble>
        )}
      </Card>
      <div className="flex max-w-[460px] flex-[1_1_340px] flex-col gap-3">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 12 }, (_, j) => j + 1).map((v) => {
            const on = sel === v;
            const bg = on ? (v === right ? '#5a8a3a' : '#b8321f') : '#fff7e2';
            return (
              <button
                key={v}
                onClick={() => pick(v)}
                className="press aspect-[1.2] rounded-[14px] border-[3px] border-ink text-[30px] shadow-hard-4"
                style={{ background: bg, color: on ? '#fbf0d4' : '#3a2614' }}
              >{v}</button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3">
          {/* わからないとき：1回目はヒント（書き順アニメ）、ヒントのあとは こたえを みる */}
          <button
            onClick={() => { if (phase === 'ask' || phase === 'hint') { setSel(null); onAnswer(false); } }}
            className="press min-h-12 rounded-xl border-[3px] border-ink bg-card px-4 text-[17px] shadow-hard-4"
          ><Mk>{hint ? '答えを 見る' : 'わからない'}</Mk></button>
          <div className="text-right text-xs text-frame">{KANJIVG_CREDIT}</div>
        </div>
      </div>
    </div>
  );
}
