// 効果音をその場で合成する（mp3 がないときに使う）。やわらかい木琴・鈴のような音で、まちがいの音もきつくしない
import type { SfxName } from './sfx';

type Wave = OscillatorType;

/** 1音：周波数 f（Hz）、開始 t（秒）、長さ d（秒）、音量 v。slide があれば その周波数へすべらせる */
function note(ctx: AudioContext, out: AudioNode, f: number, t: number, d: number, v: number, wave: Wave = 'triangle', slide?: number) {
  const at = ctx.currentTime + t;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(f, at);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, at + d);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + d);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + d + 0.02);
}

/** 鈴：基音に 高い倍音を少し重ねる */
function bell(ctx: AudioContext, out: AudioNode, f: number, t: number, d: number, v: number) {
  note(ctx, out, f, t, d, v, 'sine');
  note(ctx, out, f * 2, t, d * 0.6, v * 0.35, 'sine');
  note(ctx, out, f * 3.01, t, d * 0.35, v * 0.12, 'sine');
}

const N = (semi: number) => 440 * 2 ** ((semi - 9) / 12); // 0 = C4（ド）
const C5 = N(12), D5 = N(14), E5 = N(16), G5 = N(19), A5 = N(21), C6 = N(24), E6 = N(28), G6 = N(31), C7 = N(36);

export function playSynth(ctx: AudioContext, name: SfxName) {
  const out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(ctx.destination);
  switch (name) {
    case 'tap': // ぽっ
      note(ctx, out, 520, 0, 0.09, 0.35, 'sine', 900);
      break;
    case 'correct': // ピンポーン
      bell(ctx, out, E6, 0, 0.35, 0.45);
      bell(ctx, out, C6, 0.14, 0.7, 0.45);
      break;
    case 'hint': // ぽわん（もう一回 がんばろう）
      note(ctx, out, G5, 0, 0.18, 0.3, 'sine', A5);
      note(ctx, out, D5, 0.16, 0.4, 0.3, 'sine', E5);
      break;
    case 'wrong': // ぽ・ぽーん（下がる2音。こわくない音に）
      note(ctx, out, 392, 0, 0.16, 0.35, 'triangle');
      note(ctx, out, 294, 0.17, 0.45, 0.35, 'triangle', 262);
      break;
    case 'finish': // セットおわり：たららん
      [C5, E5, G5].forEach((f, i) => bell(ctx, out, f * 2, i * 0.09, 0.3, 0.3));
      bell(ctx, out, C7, 0.3, 0.8, 0.3);
      break;
    case 'stageClear': // ファンファーレ
      [C5, C5, C5].forEach((f, i) => note(ctx, out, f, i * 0.11, 0.1, 0.32, 'square'));
      note(ctx, out, G5, 0.36, 0.18, 0.32, 'square');
      note(ctx, out, E5, 0.56, 0.12, 0.32, 'square');
      [C5, E5, G5, C6].forEach((f) => note(ctx, out, f, 0.72, 1.1, 0.16, 'triangle'));
      bell(ctx, out, C7, 0.72, 1.2, 0.2);
      break;
    case 'evolve': // キラキラ上がっていく
      [C5, E5, G5, C6, E6, G6, C7].forEach((f, i) => bell(ctx, out, f, i * 0.08, 0.5, 0.25));
      [C6, E6, G6].forEach((f) => bell(ctx, out, f, 0.65, 1.4, 0.18));
      break;
  }
}
