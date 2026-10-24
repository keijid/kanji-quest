// ボスの せりふを Gemini の 音声合成で mp3 に する → public/voice/
//   ステージボス（お父さん・お母さん）：stage-<n>-<angry|happy>.mp3 ／ 中ボス：mid-<id>.mp3（あらわれた とき）・mid-<id>-happy.mp3（たおされた あと）
//   なかま：hero-<称号の 段階>.mp3（勇者の せりふ）・partner-fire-<しんかの 段階>.mp3（ホムラの 鳴き声）
// キーは .env.local の GEMINI_API_KEY（キーを 自動で つける プロキシ ごしなら なくてよい）。ffmpeg が いる。
// 使い方:
//   npx tsx scripts/gen-voices.ts            … ない ものだけ 作る
//   npx tsx scripts/gen-voices.ts --force 3  … ステージ3を 作りなおす（--force だけなら ぜんぶ）
//   npx tsx scripts/gen-voices.ts --force mid … 中ボスを 作りなおす（hero・homura も 同じ）
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bossLine } from '../lib/bossLines';
import { HERO_LINES, HOMURA_CRIES, heroVoice, partnerVoice } from '../lib/friendLines';
import { parseTokens } from '../lib/markup';
import { MID_BOSSES } from '../lib/midboss';

const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public/voice');
const MODEL = 'gemini-3.8-flash-tts';
// お父さん（奇数）・お母さん（偶数）。16 は 2人の 声を 重ねる
const VOICE = { dad: 'Orus', mom: 'Erinome' } as const;
type Who = keyof typeof VOICE;

// 演技の 指示は せりふの 頭に [ ] の タグで つける（ふつうの 文で 書くと、指示まで 読みあげて しまう）
const TONE: Record<Who, string> = { dad: 'deep, smooth, handsome low voice', mom: 'refined, elegant, well-bred lady voice' };
// おこる 声は めっちゃ こわく。お母さんは どなるより 冷たく おこる（どなる 指示だと 指示まで 読みあげて しまう）
const MOOD: Record<Who, Record<'angry' | 'happy', string>> = {
  dad: { angry: 'furious and terrifying, roaring like a menacing final boss', happy: 'smiling, proud and warm' },
  mom: { angry: 'icy, terrifying rage', happy: 'smiling, proud and warm' },
};

/** 1人ぶんの 声：声の 名前と、演技の 指示（long が だめなら short で やりなおす）。pre は せりふの 前に 言わせる ことば（[ ] の 指示も 書ける）。fx は ffmpeg の 音の 加工（声の 高さを かえる など） */
type Cast = { voice: string; long: string; short: string; pre?: string; fx?: string };
const cast = (w: Who, mood: 'angry' | 'happy'): Cast => ({ voice: VOICE[w], long: `${TONE[w]}; ${MOOD[w][mood]}`, short: MOOD[w][mood] });
// 中ボス：1＝おまわりさん（ゴリラの 着ぐるみ。ゴリラっぽい 声）、2＝インフルエンサー（気どった 声）
const MID_CAST: Record<number, Record<'angry' | 'happy', Cast>> = {
  1: {
    // 指示だけだと ゴリラっぽく ならないので、さいしょに「ウホッ、ウホッ！」と 言わせる
    angry: { voice: 'Algenib', long: '', short: '', pre: '[huffing like a gorilla] ウホッ、ウホッ！ [gruff gorilla voice] ' },
    happy: { voice: 'Algenib', long: '', short: '', pre: '[huffing like a gorilla] ウホッ、ウホッ！ [gruff gorilla voice, impressed] ' },
  },
  2: {
    angry: { voice: 'Zephyr', long: 'affected, snobbish show-off influencer talking to her livestream; smug and posh', short: 'smug, affected influencer' },
    happy: { voice: 'Zephyr', long: 'affected show-off influencer, suddenly excited and gushing to her livestream', short: 'excited, gushing influencer' },
  },
};

/** 声の 高さを r 倍に する（長さは かえない） */
const pitch = (r: number) => `asetrate=${24000 * r},aresample=24000,atempo=${(1 / r).toFixed(4)}`;
// 勇者：元気な 男の子。少し 高く して 子どもっぽく する
const HERO_CAST: Cast = { voice: 'Puck', long: 'energetic, brave young boy hero, cheerful and confident', short: 'energetic young boy', fx: pitch(1.12) };
// ホムラ：たまごの ころは 小さく 高い 声、しんかするほど 低く 大きな ほえ声。ことばでは なく 鳴き声
const HOMURA_CAST: Cast[] = [
  { voice: 'Leda', long: 'tiny cute baby dragon squeaking happily, not words', short: 'tiny baby dragon squeak', fx: pitch(1.3) },
  { voice: 'Leda', long: 'small baby dragon squealing like a little animal, not words', short: 'baby dragon squeal', fx: pitch(1.4) },
  { voice: 'Fenrir', long: 'young dragon growling and yelping like a wild animal, not words', short: 'young dragon yelp', fx: pitch(0.9) },
  { voice: 'Algenib', long: 'big dragon roaring like a beast, not words', short: 'big dragon roar', fx: `${pitch(0.75)},aecho=0.8:0.5:40:0.25` },
  { voice: 'Algenib', long: 'huge legendary dragon, mighty thunderous roar, not words', short: 'mighty dragon roar', fx: `${pitch(0.75)},aecho=0.8:0.6:60:0.3` },
];

function apiKey(): string | null {
  if (!existsSync(join(ROOT, '.env.local'))) return null;
  const m = readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
  return m ? m[1].trim() : null;
}

/** 記法を はずして、読ませる 文に する（ふりがなは 漢字の まま。分かち書きの 空白は つめる） */
const plain = (src: string) => parseTokens(src).map((t) => (t.t === 'ruby' ? t.base : t.s)).join('').replace(/ +/g, '');

async function tts(text: string, voice: string, style: string): Promise<Buffer> {
  const key = apiKey();
  for (let tryNo = 1; ; tryNo++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { 'x-goog-api-key': key } : {}) },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${style} ${text}`.trim() }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
    });
    const j = (await res.json()) as { error?: { message: string }; candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] };
    const d = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (res.ok && d) return Buffer.from(d.data, 'base64');
    if (tryNo >= 3) throw new Error(`API エラー ${res.status}: ${j.error?.message?.slice(0, 300) ?? '音声が ない'}`);
    await new Promise((r) => setTimeout(r, 3000 * tryNo));
  }
}

/** 音声の 長さ（秒） */
const seconds = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
/** せりふの 長さに しては 長すぎる → [ ] の 指示まで 読みあげている */
const maxSeconds = (text: string) => 1.5 + text.length * 0.2;

/** wav（または 24kHz の 生 PCM）→ 前後の 無音を けずった mp3。2つ あれば 重ねる。fx が あれば 先に かける */
function toMp3(wavs: Buffer[], out: string, fx?: string) {
  const tmp = join(tmpdir(), `voice-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const inputs = wavs.flatMap((w, i) => {
    const f = join(tmp, `${i}.wav`);
    writeFileSync(f, w);
    return w.subarray(0, 4).toString() === 'RIFF' ? ['-i', f] : ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', f];
  });
  const trim = `${fx ? `${fx},` : ''}silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse`;
  const filter = wavs.length > 1 ? ['-filter_complex', `amix=inputs=${wavs.length}:normalize=0,volume=0.8,${trim}`] : ['-af', trim];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, ...filter, '-ac', '1', '-ar', '24000', '-b:a', '48k', out]);
  rmSync(tmp, { recursive: true, force: true });
}

type Job = { name: string; key: string; text: string; casts: Cast[] };

function jobs(): Job[] {
  const out: Job[] = [];
  for (let stage = 1; stage <= 16; stage++) {
    const who: Who[] = stage === 16 ? ['dad', 'mom'] : stage % 2 ? ['dad'] : ['mom'];
    for (const mood of ['angry', 'happy'] as const) {
      out.push({ name: `stage-${stage}-${mood}`, key: String(stage), text: plain(bossLine(stage, mood === 'happy')), casts: who.map((w) => cast(w, mood)) });
    }
  }
  for (const m of MID_BOSSES) {
    out.push({ name: `mid-${m.id}`, key: 'mid', text: plain(m.line), casts: [MID_CAST[m.id].angry] });
    out.push({ name: `mid-${m.id}-happy`, key: 'mid', text: plain(m.happyLine), casts: [MID_CAST[m.id].happy] });
  }
  HERO_LINES.forEach((l, i) => out.push({ name: heroVoice(i + 1), key: 'hero', text: plain(l), casts: [HERO_CAST] }));
  HOMURA_CRIES.forEach((l, i) => out.push({ name: partnerVoice('fire', i + 1)!, key: 'homura', text: l, casts: [HOMURA_CAST[i]] }));
  return out;
}

async function main() {
  const a = process.argv.slice(2);
  const force = a.includes('--force');
  const only = a.filter((x) => x !== '--force');
  mkdirSync(OUT, { recursive: true });
  for (const { name, key, text, casts } of jobs()) {
    if (only.length && !only.includes(key)) continue;
    const out = join(OUT, `${name}.mp3`);
    if (existsSync(out) && !force) continue;
    for (let tryNo = 1; ; tryNo++) {
      // 2回 だめなら 指示を みじかく する（声の 感じは はずして、気持ちだけ）
      const wavs = await Promise.all(casts.map((c) => {
        const tag = tryNo <= 2 ? c.long : c.short;
        return tts(`${c.pre ?? ''}${text}`, c.voice, tag ? `[${tag}]` : '');
      }));
      toMp3(wavs, out, casts[0].fx);
      const sec = seconds(out);
      const max = maxSeconds(`${(casts[0].pre ?? '').replace(/\[[^\]]*\]/g, '').trim()}${text}`);
      if (sec <= max || tryNo >= 4) {
        console.log(`${sec <= max ? '✓' : '⚠ 長い'} ${name} ${sec.toFixed(1)}秒: ${text}`);
        break;
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
