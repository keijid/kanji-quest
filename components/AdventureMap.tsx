'use client';
// ホームの冒険マップ：160字（16ステージ×10字）と各ステージのボスを1本の道でつなぎ、横にスクロールして見る
// - 字をタップすると、その字の「おぼえよう」（1字ずつの練習）へ。練習ずみの字には ★
// - 字は順番に開く：今のステージでは「いまここ」まで。先のステージは うすい点線の丸（まだ行けない）
// - いまここ：今のステージで、まだ練習していない最初の字（全部練習していればボス）
// - ボスをタップすると、そのステージ画面へ
// - 中ボス（lib/midboss.ts）が 待っているときは、先の ステージの 字を タップすると いきなり あらわれる（gate）
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGame } from '@/lib/game';
import { Mk } from '@/components/ui';
import { PartnerAvatar } from '@/components/Partner';
import type { PartnerId } from '@/lib/partners';
import { MAP_ART, STAGE_COUNT, STAGE_NAMES, stageKanji } from '@/lib/data';
import { sfx } from '@/lib/sfx';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const STEP = 96; // ノードの間かく（px）
const PAD = 90; // 左右の余白（px）
const PER_STAGE = 11; // 10字＋ボス
const STAGES_PER_AREA = 4;

/** マップの ボスの 絵の 大きさ（px）。さいごの ボスは ひとまわり 大きい */
const bossSize = (stage: number) => (stage === STAGE_COUNT ? 150 : 120);

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
  /** 1字ずつの練習を終えた字 */
  practiced: Set<string>;
  bossCleared: (stage: number) => boolean;
  /** いまここ に立つ相棒 */
  partner: PartnerId;
  partnerStage: number;
  /** 称号の 段階（勇者の 絵 public/heroes/hero-<段階>.png） */
  heroRank: number;
  /** 字を えらんだ ときの 関所（中ボス）。ふだんは go をそのまま よぶ */
  gate: (stage: number, go: () => void) => void;
};

export function AdventureMap({ current, practiced, bossCleared, partner, partnerStage, heroRank, gate }: Props) {
  const router = useRouter();
  const startLesson = useGame((s) => s.startLesson);
  const nodes = useMemo(buildNodes, []);
  const scroller = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);

  // いまここ：今のステージで、まだ練習していない最初の字（全部練習していればボス）
  const here = useMemo(() => {
    const inStage = nodes.filter((n) => n.stage === current);
    return inStage.find((n) => n.kind === 'kanji' && !practiced.has(n.char!)) ?? inStage[inStage.length - 1];
  }, [nodes, current, practiced]);
  const lesson = (n: Node) => { sfx('tap'); gate(n.stage, () => { startLesson(n.char!); router.push('/lesson/'); }); };

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

          {/* ステージの旗（いまここ の字には相棒が立つので出さない。ステージ名は左上に出ている） */}
          {nodes.filter((n) => n.kind === 'kanji' && n.i % PER_STAGE === 0 && n.i !== here.i).map((n) => (
            <div
              key={`flag-${n.stage}`}
              className="absolute whitespace-nowrap rounded-md border-2 border-ink px-2 text-[13px]"
              style={{ left: n.x - 28, top: `calc(${n.y}% - 66px)`, background: n.stage <= current ? '#fbf0d4' : 'rgba(251,240,212,.75)', color: n.stage <= current ? '#3a2614' : '#8a5a34' }}
            >
              ステージ{n.stage}
            </div>
          ))}

          {nodes.map((n) => {
            // 前のステージは全部、今のステージは「いまここ」まで開く（練習ずみの字はいつでも）
            const open = n.stage < current || (n.stage === current && (n.i <= here.i || (n.kind === 'kanji' && practiced.has(n.char!))));
            const pos = { left: n.x, top: `${n.y}%` };
            if (n.kind === 'boss') {
              const cleared = bossCleared(n.stage);
              const size = bossSize(n.stage);
              // まだ たおしていない ボスは 黒い シルエットに して、どんな ボスか わからなくする（先の ステージは うすく）。たおしたら ニッコリ顔
              const filter = cleared ? undefined : open ? 'brightness(0) opacity(.85)' : 'brightness(0) opacity(.45)';
              const body = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${BASE}/bosses/stage-${n.stage}${cleared ? '-happy' : ''}.png`} alt="" className="max-w-none object-contain" style={{ width: size, height: size, filter }} />
                  <span className="-mt-1 rounded-md border-2 border-ink px-2 text-xs text-paper" style={{ background: cleared ? '#5a8a3a' : '#3a5a8a' }}>{cleared ? 'クリア' : 'ボス'}</span>
                  {n.i === here.i && <span className="mt-1 w-20 rounded-lg border-2 border-ink bg-primary text-center text-sm text-paper"><Mk>今ここ</Mk></span>}
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
                  <button
                    onClick={() => lesson(n)}
                    aria-label={`いまここ：「${n.char}」を れんしゅう`}
                    className="press flex h-[84px] w-[84px] items-center justify-center rounded-full border-4 border-ink bg-primary font-klee text-[44px] text-paper shadow-hard-6"
                  >{n.char}</button>
                  <div className="absolute left-1/2 top-[92px] w-20 -translate-x-1/2 rounded-lg border-2 border-ink bg-paper text-center text-sm"><Mk>今ここ</Mk></div>
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
            const done = practiced.has(n.char!);
            return (
              <button
                key={n.i}
                onClick={() => lesson(n)}
                aria-label={`「${n.char}」を れんしゅう（ステージ${n.stage}）${done ? '：れんしゅうずみ' : ''}`}
                className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-ink bg-card font-klee text-[30px] text-ink"
                style={pos}
              >
                {n.char}
                {done && <span className="absolute -right-1 -top-1 text-[18px] leading-none text-gold drop-shadow-[1px_1px_0_#3a2614]">★</span>}
              </button>
            );
          })}

          {/* 勇者と 相棒：いまここ の上に ならんで立つ（上が足りないときは上はしに合わせる） */}
          <div
            className="pointer-events-none absolute z-[1] flex -translate-x-1/2 items-end"
            style={{ left: here.x, top: `max(2px, calc(${here.y}% - ${here.kind === 'boss' ? 164 + (bossSize(here.stage) - 72) / 2 : 136}px))` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/heroes/hero-${heroRank}.png`} alt="" draggable={false} className="h-[100px] w-[100px] max-w-none select-none object-contain drop-shadow-[2px_3px_0_rgba(58,38,20,.35)]" />
            <div className="-ml-4 animate-bob drop-shadow-[2px_3px_0_rgba(58,38,20,.35)]">
              <PartnerAvatar id={partner} size={64} stage={partnerStage} mood={here.kind === 'boss' ? 'cheer' : undefined} />
            </div>
          </div>
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
        ><Mk>今ここへ</Mk></button>
      )}
    </>
  );
}
