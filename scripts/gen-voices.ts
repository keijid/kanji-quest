// ステージボス（お父さん・お母さん）の せりふを Gemini の 音声合成で mp3 に する → public/voice/stage-<n>-<angry|happy>.mp3
// キーは .env.local の GEMINI_API_KEY（キーを 自動で つける プロキシ ごしなら なくてよい）。ffmpeg が いる。
// 使い方:
//   npx tsx scripts/gen-voices.ts            … ない ものだけ 作る
//   npx tsx scripts/gen-voices.ts --force 3  … ステージ3を 作りなおす（--force だけなら ぜんぶ）
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bossLine } from '../lib/bossLines';
import { parseTokens } from '../lib/markup';

const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public/voice');
const MODEL = 'gemini-3.8-flash-tts';
// お父さん（奇数）・お母さん（偶数）。16 は 2人の 声を 重ねる
const VOICE = { dad: 'Orus', mom: 'Erinome' } as const;
type Who = keyof typeof VOICE;

// 演技の 指示は せりふの 頭に [ ] の タグで つける（ふつうの 文で 書くと、指示まで 読みあげて しまう）
const TONE: Record<Who, string> = { dad: 'deep, smooth, handsome low voice', mom: 'refined, elegant, well-bred lady voice' };
const MOOD: Record<'angry' | 'happy', string> = { angry: 'comically angry like a video game boss', happy: 'smiling, proud and warm' };

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
        contents: [{ parts: [{ text: `${style} ${text}` }] }],
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

/** wav（または 24kHz の 生 PCM）→ 前後の 無音を けずった mp3。2つ あれば 重ねる */
function toMp3(wavs: Buffer[], out: string) {
  const tmp = join(tmpdir(), `voice-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const inputs = wavs.flatMap((w, i) => {
    const f = join(tmp, `${i}.wav`);
    writeFileSync(f, w);
    return w.subarray(0, 4).toString() === 'RIFF' ? ['-i', f] : ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', f];
  });
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse';
  const filter = wavs.length > 1 ? ['-filter_complex', `amix=inputs=${wavs.length}:normalize=0,volume=0.8,${trim}`] : ['-af', trim];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, ...filter, '-ac', '1', '-ar', '24000', '-b:a', '48k', out]);
  rmSync(tmp, { recursive: true, force: true });
}

async function main() {
  const a = process.argv.slice(2);
  const force = a.includes('--force');
  const only = a.filter((x) => /^\d+$/.test(x)).map(Number);
  mkdirSync(OUT, { recursive: true });
  for (let stage = 1; stage <= 16; stage++) {
    if (only.length && !only.includes(stage)) continue;
    const who: Who[] = stage === 16 ? ['dad', 'mom'] : stage % 2 ? ['dad'] : ['mom'];
    for (const mood of ['angry', 'happy'] as const) {
      const out = join(OUT, `stage-${stage}-${mood}.mp3`);
      if (existsSync(out) && !force) continue;
      const text = plain(bossLine(stage, mood === 'happy'));
      for (let tryNo = 1; ; tryNo++) {
        const wavs = await Promise.all(who.map((w) => tts(text, VOICE[w], `[${TONE[w]}; ${MOOD[mood]}]`)));
        toMp3(wavs, out);
        const sec = seconds(out);
        if (sec <= maxSeconds(text) || tryNo >= 4) {
          console.log(`${sec <= maxSeconds(text) ? '✓' : '⚠ 長い'} stage-${stage}-${mood} ${sec.toFixed(1)}秒: ${text}`);
          break;
        }
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
