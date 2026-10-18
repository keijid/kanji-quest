// 効果音。public/sfx/<name>.mp3 を置き、public/sfx/sounds.json に名前を書けば鳴る（public/sfx/README.md）。
// iOS は最初のタップまで音を出せないので、unlockSfx() を最初のタップで呼ぶ（AppShell）。
export type SfxName = 'tap' | 'correct' | 'wrong' | 'hint' | 'evolve' | 'stageClear';
export const SFX_NAMES: SfxName[] = ['tap', 'correct', 'wrong', 'hint', 'evolve', 'stageClear'];

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
let enabled = true;
let ctx: AudioContext | null = null;
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

export function unlockSfx() {
  if (ctx || typeof window === 'undefined') return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  void ctx.resume();
  fetch(`${BASE}/sfx/sounds.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((names: string[]) => names.filter((n): n is SfxName => (SFX_NAMES as string[]).includes(n)).forEach((n) => void load(n)))
    .catch(() => {});
}

export function sfx(name: SfxName) {
  if (!enabled || !ctx) return;
  const buf = buffers.get(name);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
}
