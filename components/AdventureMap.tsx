'use client';
// ホームの冒険マップ：160字（16ステージ×10字）と各ステージのボスを1本の道でつなぎ、横にスクロールして見る
// - 今いるステージまで：字をタップするとそのステージへ。覚えた字には ★
// - 先のステージ：うすい点線の丸（まだ行けない）
// - いまここ：今のステージで、まだ覚えていない最初の字（全部覚えていればボス）
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Mk } from '@/components/ui';
import { MAP_ART, STAGE_COUNT, STAGE_NAMES, stageKanji } from '@/lib/data';
import { sfx } from '@/lib/sfx';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const STEP = 96; // ノードの間かく（px）
const PAD = 90; // 左右の余白（px）
const PER_STAGE = 11; // 10字＋ボス
const STAGES_PER_AREA = 4;

type Node = { i: number; stage: number; kind: 'kanji' | 'boss'; char?: string; x: number; y: number };

/** 道の高さ（%）。ゆるやかに上下する */
const yOf = (i: number) => Math.max(26, Math.min(80, 53 + 20 * Math.sin(i * 0.72) + 6 * Math.sin(i * 0.29 + 1)));

function buildNodes(): Node[] {
  const out: Node[] = [];
  for (let s = 1; s <= STAGE_COUNT; s++) {
    stageKanji(s).forEach((k, j) => {
      const i = (s - 1) * PER_STAGE + j;
      out.push({ i, stage: s, kind: 'kanji', char: k.char, x: PAD + i * STEP, y: yOf(i) });
    });
    const i = (s - 1) * PER_STAGE + 10;
    out.push({ i, stage: s, kind: 'boss', x: PAD + i * STEP, y: yOf(i) });
  }
  return out;
}

const WIDTH = PAD * 2 + (STAGE_COUNT * PER_STAGE - 1) * STEP;
const areaLeft = (a: number) => (a === 0 ? 0 : PAD + a * STAGES_PER_AREA * PER_STAGE * STEP - STEP / 2);

type Props = {
  current: number;
  learned: Set<string>;
  bossCleared: (stage: number) => boolean;
};

export function AdventureMap({ current, learned, bossCleared }: Props) {
  const nodes = useMemo(buildNodes, []);
  const scroller = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);

  // いまここ：今のステージで、まだ覚えていない最初の字（全部覚えていればボス）
  const here = useMemo(() => {
    const inStage = nodes.filter((n) => n.stage === current);
    return inStage.find((n) => n.kind === 'kanji' && !learned.has(n.char!)) ?? inStage[inStage.length - 1];
  }, [nodes, current, learned]);

  const scrollToHere = (smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: here.x - el.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => { scrollToHere(false); /* はじめは今いる場所を真ん中に */ }, [here.i]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setAway(Math.abs(el.scrollLeft + el.clientWidth / 2 - here.x) > el.clientWidth / 2);
  };

  return (
    <>
      <div ref={scroller} onScroll={onScroll} className="absolute inset-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin]">
        <div className="relative h-full" style={{ width: WIDTH }}>
          {/* 背景：エリアごとの帯をくり返す。となりのエリアとの境目はぼかす */}
          {MAP_ART.map((art, a) => {
            const left = areaLeft(a);
            const right = a === MAP_ART.length - 1 ? WIDTH : areaLeft(a + 1) + 140;
            return (
              <div
                key={art}
                className="absolute inset-y-0"
                style={{
                  left,
                  width: right - left,
                  backgroundImage: `url(${BASE}/maps/${art}-strip.jpg)`,
                  backgroundSize: 'auto 100%',
                  backgroundRepeat: 'repeat-x',
                  maskImage: a === 0 ? undefined : 'linear-gradient(to right, transparent 0, #000 140px)',
                  WebkitMaskImage: a === 0 ? undefined : 'linear-gradient(to right, transparent 0, #000 140px)',
                }}
              />
            );
          })}

          {/* 道：今いる場所までは濃い色、その先はうすい色 */}
          <svg className="pointer-events-none absolute inset-0 h-full" width={WIDTH} aria-hidden>
            {nodes.slice(1).map((n, k) => {
              const p = nodes[k];
              return (
                <line key={n.i} x1={p.x} y1={`${p.y}%`} x2={n.x} y2={`${n.y}%`} stroke={n.i <= here.i ? '#8a5a34' : '#c9a46a'} strokeWidth={4} strokeDasharray="10 8" />
              );
            })}
          </svg>

          {/* ステージの旗 */}
          {nodes.filter((n) => n.kind === 'kanji' && n.i % PER_STAGE === 0).map((n) => (
            <div
              key={`flag-${n.stage}`}
              className="absolute whitespace-nowrap rounded-md border-2 border-ink px-2 text-[13px]"
              style={{ left: n.x - 28, top: `calc(${n.y}% - 66px)`, background: n.stage <= current ? '#fbf0d4' : 'rgba(251,240,212,.75)', color: n.stage <= current ? '#3a2614' : '#8a5a34' }}
            >
              ステージ{n.stage}
            </div>
          ))}

          {nodes.map((n) => {
            const open = n.stage <= current;
            const pos = { left: n.x, top: `${n.y}%` };
            if (n.kind === 'boss') {
              const cleared = bossCleared(n.stage);
              const size = n.stage === STAGE_COUNT ? 96 : 72;
              const body = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${BASE}/bosses/stage-${n.stage}.png`} alt="" style={{ width: size, height: size, filter: open ? undefined : 'saturate(.6) opacity(.75)' }} />
                  <span className="-mt-1 rounded-md border-2 border-ink px-2 text-xs text-paper" style={{ background: cleared ? '#5a8a3a' : '#3a5a8a' }}>{cleared ? 'クリア' : 'ボス'}</span>
                  {n.i === here.i && <span className="mt-1 w-20 rounded-lg border-2 border-ink bg-primary text-center text-sm text-paper">いまここ</span>}
                </>
              );
              return open ? (
                <Link key={n.i} href={`/stage/${n.stage}/`} onClick={() => sfx('tap')} aria-label={`${n.i === here.i ? 'いまここ：' : ''}ステージ${n.stage}のボス`} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center no-underline" style={pos}>{body}</Link>
              ) : (
                <div key={n.i} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={pos}>{body}</div>
              );
            }
            if (n.i === here.i) {
              return (
                <div key={n.i} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos}>
                  <Link
                    href={`/stage/${n.stage}/`}
                    onClick={() => sfx('tap')}
                    aria-label={`いまここ：ステージ${n.stage}`}
                    className="press flex h-[84px] w-[84px] items-center justify-center rounded-full border-4 border-ink bg-primary font-klee text-[44px] text-paper no-underline shadow-hard-6"
                  >{n.char}</Link>
                  <div className="absolute left-1/2 top-[92px] w-20 -translate-x-1/2 rounded-lg border-2 border-ink bg-paper text-center text-sm">いまここ</div>
                </div>
              );
            }
            if (!open) {
              return (
                <div key={n.i} className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-dashed border-frame font-klee text-[28px] text-muted" style={{ ...pos, background: '#f8ebc6' }}>
                  {n.char}
                </div>
              );
            }
            const done = learned.has(n.char!);
            return (
              <Link
                key={n.i}
                href={`/stage/${n.stage}/`}
                onClick={() => sfx('tap')}
                aria-label={`${n.char}（ステージ${n.stage}）${done ? '：おぼえた' : ''}`}
                className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-ink bg-card font-klee text-[30px] text-ink no-underline"
                style={pos}
              >
                {n.char}
                {done && <span className="absolute -right-1 -top-1 text-[18px] leading-none text-gold drop-shadow-[1px_1px_0_#3a2614]">★</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 今のステージ名（スクロールしても動かない） */}
      <div className="pointer-events-none absolute left-4 top-3 z-[1] rounded-lg border-2 border-ink bg-paper px-3 py-0.5 text-[19px]">
        ステージ {current} / {STAGE_COUNT} ・ <Mk>{STAGE_NAMES[current - 1]}</Mk>
      </div>
      {away && (
        <button
          onClick={() => { sfx('tap'); scrollToHere(true); }}
          className="press absolute bottom-3 right-3 z-[1] rounded-xl border-2 border-ink bg-primary px-3 py-1.5 text-[15px] text-paper shadow-hard-4"
        >いまここへ</button>
      )}
    </>
  );
}
