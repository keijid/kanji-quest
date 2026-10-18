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

  // マスの中身：よみ＝答えのひらがな1字ずつ、かき＝漢字1字、おくりがな＝漢字＋おくりがな1字ずつ
  const expected: { ch: string; kanji: boolean }[] =
    q.kind === 'read' ? [...q.answer].map((ch) => ({ ch, kanji: false }))
      : q.kind === 'write' ? [{ ch: q.char, kanji: true }]
        : [{ ch: q.char, kanji: true }, ...[...q.okuri].map((ch) => ({ ch, kanji: false }))];

  const onChange = () => setFilled(pads.current.some((p) => p && !p.isEmpty()));
  const clear = () => { pads.current.forEach((p) => p?.clear()); setFilled(false); };

  const check = () => {
    setBusy(true);
    // 判定は少し重いので、ボタンの見た目が変わってから行う
    setTimeout(() => {
      const ok = expected.every((e, j) => {
        const s = pads.current[j]?.strokes() ?? [];
        return (e.kanji ? judgeKanji(s, e.ch) : judgeKana(s, e.ch)).ok;
      });
      setBusy(false);
      if (!ok) clear();
      onAnswer(ok);
    }, 30);
  };

  const prompt = q.kind === 'read' ? '――せんの かんじの よみを ひらがなで かこう' : q.kind === 'write' ? '――せんの ひらがなを かんじで かこう' : '――せんを かんじと おくりがなで かこう';
  const n = expected.length;
  const cols = Math.max(n, 4);

  return (
    <div className="flex flex-1 flex-wrap items-stretch gap-5">
      <Card className="flex flex-[1_1_340px] flex-col justify-center gap-[18px] rounded-[18px] p-6">
        <div className="text-[17px] text-frame">{prompt}</div>
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
                className="aspect-square rounded-xl border-[3px] border-ink bg-cell"
                style={{ flex: `0 1 calc((100% - ${10 * (cols - 1)}px) / ${cols})` }}
              />
            ))}
          </div>
        )}
        {q.kind === 'write' && (
          <HandwritingPad ref={(h) => { pads.current[0] = h; }} onChange={onChange} className="aspect-square w-[min(100%,440px)] rounded-2xl border-4 border-ink bg-cell" />
        )}
        {q.kind === 'okuri' && (
          <div className="flex w-[min(100%,460px)] items-end gap-3">
            <div className="flex flex-[2] flex-col items-center gap-1.5">
              <div className="text-[15px] text-frame">かんじ</div>
              <HandwritingPad ref={(h) => { pads.current[0] = h; }} onChange={onChange} className="aspect-square w-full rounded-2xl border-4 border-ink bg-cell" />
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
                    className="aspect-square flex-1 rounded-2xl border-4 border-dashed border-primary bg-cell"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div className={`flex gap-3 ${q.kind === 'read' ? 'w-full' : 'w-[min(100%,460px)]'}`}>
          {/* わからないとき：1回目はヒント、ヒントのあとは こたえを みる（＝まちがえたのと同じあつかい） */}
          <Btn className="min-h-[68px] flex-1 px-1 text-[17px] leading-tight" onClick={() => { clear(); onAnswer(false); }} disabled={busy}>
            {hint ? 'こたえを みる' : 'わからない'}
          </Btn>
          <Btn className="min-h-[68px] flex-1 text-xl" onClick={clear}>けす</Btn>
          <Btn tone="green" className="min-h-[68px] flex-[2] font-yusei text-[26px]" onClick={check} disabled={!filled || busy}>
            {busy ? 'みているよ…' : submitLabel ?? (hint ? 'もう いちど' : 'こたえあわせ')}
          </Btn>
        </div>
      </div>
    </div>
  );
}
