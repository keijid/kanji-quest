// 効果音。ふだんは lib/sfx-synth.ts でその場で合成して鳴らす。
// public/sfx/<name>.mp3 を置き、public/sfx/sounds.json に名前を書けば、その音に差しかわる（public/sfx/README.md）。
// iOS は タップ（指を はなしたとき・click）の中でしか 音を 出しはじめられないので、unlockSfx() を タップのたびに呼ぶ（AppShell）。
// ホーム画面アプリは 裏に回って もどると AudioContext が 止まったまま（interrupted など）に なりやすいので、
// もどってきた あとの さいしょの タップで 作りなおす。
import { playSynth } from './sfx-synth';

export type SfxName = 'tap' | 'correct' | 'wrong' | 'hint' | 'finish' | 'levelUp' | 'evolve' | 'stageClear' | 'ambush';
export const SFX_NAMES: SfxName[] = ['tap', 'correct', 'wrong', 'hint', 'finish', 'levelUp', 'evolve', 'stageClear', 'ambush'];

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
let enabled = true;
let ctx: AudioContext | null = null;
/** 裏に回った → つぎの タップで AudioContext を 作りなおす */
let stale = false;
let listening = false;
const buffers = new Map<SfxName, AudioBuffer | null>();

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

async function load(name: SfxName) {
  if (buffers.has(name) || !ctx) return;
  buffers.set(name, null);
  try {
    const res = await fetch(`${BASE}/sfx/${name}.mp3`);
    if (!res.ok) return;
    buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
  } catch {
    // ファイルがない・読めない → 鳴らさない
  }
}

/** 長さ 1 サンプルの 無音を 鳴らす。iOS は タップの中で 何か 鳴らすと、その あとも 音が 出せるように なる */
function playSilence(c: AudioContext) {
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start();
}

export function unlockSfx() {
  if (typeof window === 'undefined') return;
  // state が running でも 音が 出ないことが あるので、もどってきたら かならず 作りなおす
  if (ctx && stale) {
    void ctx.close().catch(() => {});
    ctx = null;
  }
  stale = false;
  if (ctx) {
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => {});
      playSilence(ctx);
    }
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  void ctx.resume().catch(() => {});
  playSilence(ctx);
  if (listening) return;
  // ここからは さいしょの 1回だけ
  listening = true;
  document.addEventListener('visibilitychange', () => { if (document.hidden) stale = true; });
  fetch(`${BASE}/sfx/sounds.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((names: string[]) => names.filter((n): n is SfxName => (SFX_NAMES as string[]).includes(n)).forEach((n) => void load(n)))
    .catch(() => {});
}

export function sfx(name: SfxName) {
  if (!enabled || !ctx) return;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  const buf = buffers.get(name);
  if (!buf) return playSynth(ctx, name);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
}

// ステージボス（お父さん・お母さん）の 声。public/voice/stage-<n>-<angry|happy>.mp3（scripts/gen-voices.ts で 作る）
// 効果音を 切っていれば 鳴らさない。つぎの 声が 鳴ったら 前の 声は 止める
const voiceFiles = new Map<string, Promise<ArrayBuffer | null>>();
const voiceBufs = new Map<string, AudioBuffer>();
let voiceSrc: AudioBufferSourceNode | null = null;

/** 先に 読みこんで おく（鳴らす ときに 待たない） */
export function preloadVoice(name: string) {
  if (typeof window === 'undefined' || voiceFiles.has(name)) return voiceFiles.get(name);
  const p = fetch(`${BASE}/voice/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  voiceFiles.set(name, p);
  return p;
}

/** delay 秒 あとに 鳴らす（読みこみに 時間が かかったら、その ぶん 待つ 時間を へらす） */
export function voice(name: string, delay = 0) {
  if (!enabled || !ctx) return;
  const c = ctx;
  const at = c.currentTime + delay;
  void (async () => {
    let buf = voiceBufs.get(name);
    if (!buf) {
      const file = await preloadVoice(name);
      if (!file) return;
      try {
        buf = await c.decodeAudioData(file.slice(0));
      } catch {
        return;
      }
      voiceBufs.set(name, buf);
    }
    if (!enabled || ctx !== c) return;
    try { voiceSrc?.stop(); } catch { /* もう 止まっている */ }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(Math.max(at, c.currentTime));
    voiceSrc = src;
  })();
}
