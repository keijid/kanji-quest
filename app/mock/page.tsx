'use client';
// 09 もぎテスト：選択 → 実施 → けっか。テスト中はヒントなし・1回だけ答える
import { useEffect, useState } from 'react';
import { BackBtn, Btn, Card, ProgressBar } from '@/components/ui';
import { StrokeSvg, KANJIVG_CREDIT } from '@/components/StrokeSvg';
import { WriteQ } from '@/components/play/WriteQ';
import { useAppData } from '@/lib/hooks';
import { db, type MockField } from '@/lib/db';
import { buildMock, FIELD_TITLE, FULL, maxScore, MINI, type MockTest } from '@/lib/mock';
import { recordAnswers, type AnswerLog } from '@/lib/progress';
import type { Question } from '@/lib/quiz';
import { sfx } from '@/lib/sfx';

type Run = { test: MockTest; endAt: number; sec: number; idx: number; answers: boolean[] };
type Done = { test: MockTest; answers: boolean[]; score: number; max: number };

export default function Mock() {
  const d = useAppData();
  const [run, setRun] = useState<Run | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [left, setLeft] = useState(0);

  const flat = run ? run.test.sections.flatMap((s) => s.questions.map((q) => ({ q, field: s.field }))) : [];

  const finish = async (r: Run, answers: boolean[]) => {
    const all = r.test.sections.flatMap((s) => s.questions.map((q) => ({ q, field: s.field })));
    const byField: Partial<Record<MockField, { correct: number; total: number }>> = {};
    all.forEach(({ field }, i) => {
      const f = (byField[field] ??= { correct: 0, total: 0 });
      f.total++;
      if (answers[i]) f.correct++;
    });
    const score = answers.filter(Boolean).length * r.test.points;
    const max = maxScore(r.test);
    const at = Date.now();
    // id は時刻にする（端末をまたいでクラウドに保存しても重ならないように）
    await db.mocks.put({ id: at, kind: r.test.kind, score, max, byField, at });
    // 答えた問題は学習の記録にも入れる（まちがえた字は苦手へ）
    const logs: AnswerLog[] = all.slice(0, answers.length).map(({ q }, i) => ({ char: q.char, mode: q.kind, outcome: answers[i] ? 2 : 0 }));
    await recordAnswers(logs);
    sfx('stageClear');
    setRun(null);
    setDone({ test: r.test, answers, score, max });
  };

  // 残り時間
  useEffect(() => {
    if (!run) return;
    const tick = () => {
      const s = Math.max(0, Math.round((run.endAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) void finish(run, run.answers);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [run]);

  if (!d?.profile) return null;

  const start = (kind: 'full' | 'mini') => {
    const test = buildMock(kind, d.weak);
    setDone(null);
    setRun({ test, endAt: Date.now() + test.minutes * 60_000, sec: test.minutes * 60, idx: 0, answers: [] });
  };

  const answer = (ok: boolean) => {
    if (!run) return;
    sfx('tap');
    const answers = [...run.answers, ok];
    if (answers.length >= flat.length) void finish(run, answers);
    else setRun({ ...run, idx: run.idx + 1, answers });
  };

  const fulls = d.mocks.filter((m) => m.kind === 'full');
  const minis = d.mocks.filter((m) => m.kind === 'mini').sort((a, b) => b.at - a.at);
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');

  return (
    <div data-screen-label="09 もぎテスト" className="flex flex-1 flex-col gap-[18px] px-[clamp(16px,2.4vw,28px)] pb-20 pt-4">
      {!run && !done && (
        <>
          <div className="flex items-center gap-[14px]">
            <BackBtn href="/home/" />
            <div className="font-yusei text-[clamp(24px,3vw,32px)]">もぎテスト</div>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
            <button onClick={() => { sfx('tap'); start('full'); }} className="press flex min-h-[320px] max-w-[460px] flex-[1_1_320px] flex-col gap-3 rounded-[22px] border-[3px] border-ink bg-boss p-7 text-left text-paper shadow-hard-7">
              <div className="text-base opacity-85">ほんばんと おなじ</div>
              <div className="font-yusei text-[40px]">ほんばん テスト</div>
              <div className="grid gap-x-[14px] gap-y-1.5 text-lg" style={{ gridTemplateColumns: 'auto 1fr' }}>
                <div className="opacity-80">じかん</div><div>{FULL.minutes}ぷん</div>
                <div className="opacity-80">まんてん</div><div>150てん（ごうかく {FULL.pass}てん くらい）</div>
                <div className="opacity-80">もんだい</div><div>よみ・かき・かきじゅん・かくすう</div>
              </div>
              <div className="flex-1" />
              <div className="text-base opacity-85">
                {fulls.length ? `さいこう ${Math.max(...fulls.map((m) => m.score))}てん ・ ${fulls.length}かい チャレンジ` : 'まだ チャレンジ していないよ'}
              </div>
            </button>
            <button onClick={() => { sfx('tap'); start('mini'); }} className="press flex min-h-[320px] max-w-[460px] flex-[1_1_320px] flex-col gap-3 rounded-[22px] border-[3px] border-ink bg-card p-7 text-left shadow-hard-7">
              <div className="text-base text-frame">すきま じかんに</div>
              <div className="font-yusei text-[40px]">ミニ テスト</div>
              <div className="grid gap-x-[14px] gap-y-1.5 text-lg" style={{ gridTemplateColumns: 'auto 1fr' }}>
                <div className="text-frame">じかん</div><div>{MINI.minutes}ぷん</div>
                <div className="text-frame">もんだい</div><div>{MINI.count}もん（にがて おおめ）</div>
              </div>
              <div className="flex-1" />
              <div className="text-base text-frame">{minis.length ? `さいきん ${minis[0].score} / ${minis[0].max} もん` : 'まだ チャレンジ していないよ'}</div>
            </button>
          </div>
        </>
      )}

      {run && (() => {
        const { q, field } = flat[run.idx];
        const secIdx = run.test.sections.findIndex((s) => s.field === field);
        return (
          <>
            <div className="flex flex-wrap items-center gap-[14px]">
              <BackBtn onClick={() => setRun(null)} label="やめる" />
              <div className="font-yusei text-2xl">{run.test.kind === 'full' ? 'ほんばん テスト' : 'ミニ テスト'}</div>
              <div className="flex-1" />
              <div className="flex gap-1.5">
                {run.test.sections.map((s, i) => (
                  <div key={s.field} className="rounded-[10px] border-2 border-ink px-[14px] py-2 text-[15px]" style={{ background: i === secIdx ? '#3a2614' : '#fff7e2', color: i === secIdx ? '#fbf0d4' : '#3a2614' }}>
                    {FIELD_TITLE[s.field]}{i < secIdx ? ' ✓' : ''}
                  </div>
                ))}
              </div>
              <div className="min-w-[120px] rounded-xl border-[3px] border-primary bg-card px-[14px] py-2 text-center text-[22px] text-primary">のこり {mm}:{ss}</div>
            </div>
            <ProgressBar value={run.idx / flat.length} height={12} />
            {q.kind === 'stroke' ? (
              <MockStroke key={run.idx} q={q} no={run.idx + 1} onAnswer={answer} />
            ) : (
              <WriteQ key={run.idx} q={q} hint={false} onAnswer={answer} submitLabel="つぎへ" />
            )}
          </>
        );
      })()}

      {done && (
        <>
          <div className="flex items-center gap-[14px]">
            <BackBtn onClick={() => setDone(null)} />
            <div className="font-yusei text-[clamp(24px,3vw,32px)]">{done.test.kind === 'full' ? 'ほんばん テスト' : 'ミニ テスト'} の けっか</div>
          </div>
          <div className="flex flex-1 flex-wrap content-center gap-5">
            <Card shadow={6} className="flex flex-[1_1_360px] flex-col items-center gap-3 rounded-[22px] p-7">
              <div className="font-yusei text-[44px]">{done.test.kind === 'full' ? (done.score >= FULL.pass ? 'ごうかく ライン こえた！' : 'よく がんばった！') : 'おつかれさま！'}</div>
              <div className="text-[22px]"><span className="text-[64px] text-primary">{done.score}</span> / {done.max} {done.test.kind === 'full' ? 'てん' : 'もん'}</div>
              {done.test.kind === 'full' && <div className="text-base text-frame">ごうかくの めやすは {FULL.pass}てん</div>}
            </Card>
            <Card shadow={6} className="flex flex-[1_1_320px] flex-col gap-3 rounded-[22px] p-6">
              {done.test.sections.map((s) => {
                const start = done.test.sections.slice(0, done.test.sections.indexOf(s)).reduce((n, x) => n + x.questions.length, 0);
                const c = done.answers.slice(start, start + s.questions.length).filter(Boolean).length;
                return (
                  <div key={s.field} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[17px]"><span>{FIELD_TITLE[s.field]}</span><span>{c} / {s.questions.length}</span></div>
                    <ProgressBar value={s.questions.length ? c / s.questions.length : 0} height={14} color={s.questions.length && c / s.questions.length < 0.75 ? '#b8321f' : '#5a8a3a'} />
                  </div>
                );
              })}
              <Btn tone="red" className="mt-2 min-h-16 font-yusei text-2xl" onClick={() => setDone(null)}>もどる</Btn>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MockStroke({ q, no, onAnswer }: { q: Extract<Question, { kind: 'stroke' }>; no: number; onAnswer: (ok: boolean) => void }) {
  return (
    <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
      <Card className="flex flex-[0_1_320px] flex-col items-center gap-3 rounded-[20px] p-6">
        <div className="text-[17px] text-frame">もんだい {no}</div>
        <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border-[3px] border-ink bg-cell p-3 font-klee text-[170px] leading-none">
          {q.sub === 'total' ? q.char : <StrokeSvg char={q.char} highlight={q.index} />}
        </div>
        <div className="text-center text-[22px]">{q.sub === 'total' ? 'ぜんぶで なんかく？' : <><span className="text-primary">あかい ところ</span>は なんかくめ？</>}</div>
        {q.sub === 'nth' && <div className="text-xs text-frame">{KANJIVG_CREDIT}</div>}
      </Card>
      <div className="grid max-w-[480px] flex-[1_1_360px] grid-cols-4 gap-3">
        {Array.from({ length: 12 }, (_, j) => j + 1).map((v) => (
          <button key={v} onClick={() => onAnswer(v === q.index + 1)} className="press aspect-[1.2] rounded-[14px] border-[3px] border-ink bg-card text-[30px] shadow-hard-4">{v}</button>
        ))}
      </div>
    </div>
  );
}
