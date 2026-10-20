'use client';
import { useRef, useState } from 'react';
import { Btn, Card, Mk } from '@/components/ui';
import { HandwritingPad, type PadHandle } from '@/components/HandwritingPad';
import { Sentence } from './Sentence';
import { HintBubble } from './HintBubble';
import { hintFor } from '@/lib/hints';
import { judgeKana, judgeKanji } from '@/lib/recognize';
import type { Question } from '@/lib/quiz';
import type { PartnerId } from '@/lib/partners';

// ---- 手書きで答える問題（よみ・かき・おくりがな） ----
export function WriteQ({ q, partner, partnerStage = 1, hint, onAnswer, submitLabel }: {
  q: Exclude<Question, { kind: 'stroke' }>;
  partner?: PartnerId;
  /** 相棒の進化の段階（ヒントのアイコン） */
  partnerStage?: number;
  hint: boolean;
  onAnswer: (ok: boolean) => void;
  /** もぎテストでは「つぎへ」 */
  submitLabel?: string;
}) {
  const pads = useRef<(PadHandle | null)[]>([]);
  const [filled, setFilled] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 答え合わせで ちがうと 出た マス（赤くして、そこだけ 書き直してもらう） */
  const [wrong, setWrong] = useState<number[]>([]);

  // マスの中身：よみ＝答えのひらがな1字ずつ、かき＝漢字1字、おくりがな＝漢字＋おくりがな1字ずつ
  const expected: { ch: string; kanji: boolean }[] =
    q.kind === 'read' ? [...q.answer].map((ch) => ({ ch, kanji: false }))
      : q.kind === 'write' ? [{ ch: q.char, kanji: true }]
        : [{ ch: q.char, kanji: true }, ...[...q.okuri].map((ch) => ({ ch, kanji: false }))];

  // ちがうと 出た マスが あるときは、その マスを ぜんぶ 書き直したら 答え合わせ できる
  const updateFilled = (w: number[]) => setFilled(w.length
    ? w.every((j) => pads.current[j] && !pads.current[j]!.isEmpty())
    : pads.current.some((p) => p && !p.isEmpty()));
  // 書くたびに 描き直して、書き直した 赤い マスの 色を もどす
  const [, setTick] = useState(0);
  const onChange = () => { updateFilled(wrong); setTick((t) => t + 1); };
  const clear = () => { pads.current.forEach((p) => p?.clear()); setWrong([]); setFilled(false); };
  /** まだ 書き直していない 赤い マス */
  const isRed = (j: number) => wrong.includes(j) && (pads.current[j]?.isEmpty() ?? true);
  /** 赤い マスと ふつうの マスの わく */
  const frame = (j: number, normal: string) => (isRed(j) ? 'border-primary shadow-[0_0_0_4px_rgba(184,50,31,.25)]' : normal);

  const check = () => {
    setBusy(true);
    // 判定は少し重いので、ボタンの見た目が変わってから行う
    setTimeout(() => {
      const strokesOf = (j: number) => pads.current[j]?.strokes() ?? [];
      let bad = expected.flatMap((e, j) => ((e.kanji ? judgeKanji(strokesOf(j), e.ch) : judgeKana(strokesOf(j), e.ch)).ok ? [] : [j]));
      // 3文字以上の 読みは、1文字ずつ 合っていても ぜんぶ そろう のが むずかしい（6文字なら 1字 97% でも 83%）。
      // ほかが ぜんぶ 合っていて 1文字だけ 落ちたら、その字は ゆるめに 見直す
      if (q.kind === 'read' && expected.length >= 3 && bad.length === 1 && judgeKana(strokesOf(bad[0]), expected[bad[0]].ch, true).ok) bad = [];
      setBusy(false);
      // 合っていた マスは のこし、ちがう マスだけ 消して 赤くする
      bad.forEach((j) => pads.current[j]?.clear());
      setWrong(bad);
      updateFilled(bad);
      onAnswer(bad.length === 0);
    }, 30);
  };

  const prompt = q.kind === 'read' ? '――線の かん字の 読みを ひらがなで 書こう' : q.kind === 'write' ? '――線の ひらがなを かん字で 書こう' : '――線を かん字と おくりがなで 書こう';
  const n = expected.length;
  const cols = Math.max(n, 4);

  return (
    <div className="flex flex-1 flex-wrap items-stretch gap-5">
      <Card className="flex flex-[1_1_340px] flex-col justify-center gap-[18px] rounded-[18px] p-6">
        <div className="text-[17px] text-frame"><Mk>{prompt}</Mk></div>
        <Sentence src={q.sentence} />
        {hint && partner && <HintBubble partner={partner} stage={partnerStage}><Mk>{hintFor(q)}</Mk></HintBubble>}
      </Card>
      <div className={`flex flex-[1_1_420px] flex-col gap-[14px] ${q.kind === 'read' ? '' : 'items-center justify-center'}`}>
        {q.kind === 'read' && (
          <div className="flex flex-1 flex-wrap content-center justify-center gap-2.5">
            {expected.map((_, j) => (
              <HandwritingPad
                key={j}
                ref={(h) => { pads.current[j] = h; }}
                onChange={onChange}
                className={`aspect-square rounded-xl border-[3px] bg-cell ${frame(j, 'border-ink')}`}
                style={{ flex: `0 1 calc((100% - ${10 * (cols - 1)}px) / ${cols})` }}
              />
            ))}
          </div>
        )}
        {q.kind === 'write' && (
          <HandwritingPad ref={(h) => { pads.current[0] = h; }} onChange={onChange} className={`aspect-square w-[min(100%,440px)] rounded-2xl border-4 bg-cell ${frame(0, 'border-ink')}`} />
        )}
        {q.kind === 'okuri' && (
          <div className="flex w-[min(100%,460px)] items-end gap-3">
            <div className="flex flex-[2] flex-col items-center gap-1.5">
              <div className="text-[15px] text-frame"><Mk>かん字</Mk></div>
              <HandwritingPad ref={(h) => { pads.current[0] = h; }} onChange={onChange} className={`aspect-square w-full rounded-2xl border-4 bg-cell ${frame(0, 'border-ink')}`} />
            </div>
            <div className="flex flex-col items-center gap-1.5" style={{ flex: Math.max(1, n - 1) }}>
              <div className="text-[15px] text-frame">おくりがな</div>
              <div className="flex w-full gap-1.5">
                {expected.slice(1).map((_, j) => (
                  <HandwritingPad
                    key={j}
                    ref={(h) => { pads.current[j + 1] = h; }}
                    onChange={onChange}
                    guide={false}
                    className={`aspect-square flex-1 rounded-2xl border-4 bg-cell ${isRed(j + 1) ? 'border-solid border-primary shadow-[0_0_0_4px_rgba(184,50,31,.25)]' : 'border-dashed border-primary'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        {wrong.length > 0 && (
          <div className="text-center text-[17px] text-primary"><Mk>{expected.length > 1 ? '赤い マスの 字が ちがうみたい。そこだけ もう一回 書こう' : 'もう一回 書いて みよう'}</Mk></div>
        )}
        <div className={`flex gap-3 ${q.kind === 'read' ? 'w-full' : 'w-[min(100%,460px)]'}`}>
          {/* わからないとき：1回目はヒント、ヒントのあとは こたえを みる（＝まちがえたのと同じあつかい） */}
          <Btn className="min-h-[68px] flex-1 px-1 text-[17px] leading-tight" onClick={() => { clear(); onAnswer(false); }} disabled={busy}>
            <Mk>{hint ? '答えを 見る' : 'わからない'}</Mk>
          </Btn>
          <Btn className="min-h-[68px] flex-1 text-xl" onClick={clear}>けす</Btn>
          <Btn tone="green" className="min-h-[68px] flex-[2] font-yusei text-[26px]" onClick={check} disabled={!filled || busy}>
            <Mk>{busy ? '見ているよ…' : submitLabel ?? (hint ? 'もう一回' : '答え合わせ')}</Mk>
          </Btn>
        </div>
      </div>
    </div>
  );
}
