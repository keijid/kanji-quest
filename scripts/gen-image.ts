// Gemini API で画像を作る（キーは .env.local の GEMINI_API_KEY。画面には出さない）
// 使い方:
//   npx tsx scripts/gen-image.ts --prompt-file prompts/x.txt --ref public/partners/fire-1.png --out assets/gen/x.png
//   オプション: --model gemini-3.1-flash-image（既定） / --aspect 1:1（既定） / --size 1K|2K|4K（既定 1K） / --prompt "…"（ファイルの代わり）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

const ROOT = join(__dirname, '..');

function apiKey() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const m = env.match(/^GEMINI_API_KEY=(.+)$/m);
  if (!m) throw new Error('.env.local に GEMINI_API_KEY がない');
  return m[1].trim();
}

function args() {
  const a = process.argv.slice(2);
  const out: { model: string; aspect: string; size: string; prompt: string; refs: string[]; out: string } = {
    model: 'gemini-3.1-flash-image', aspect: '1:1', size: '1K', prompt: '', refs: [], out: '',
  };
  for (let i = 0; i < a.length; i += 2) {
    const [k, v] = [a[i], a[i + 1]];
    if (k === '--model') out.model = v;
    else if (k === '--aspect') out.aspect = v;
    else if (k === '--size') out.size = v;
    else if (k === '--prompt') out.prompt = v;
    else if (k === '--prompt-file') out.prompt = readFileSync(v, 'utf8');
    else if (k === '--ref') out.refs.push(v);
    else if (k === '--out') out.out = v;
    else throw new Error(`知らないオプション: ${k}`);
  }
  if (!out.prompt || !out.out) throw new Error('--prompt（または --prompt-file）と --out が必要');
  return out;
}

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

async function main() {
  const o = args();
  const parts: unknown[] = [
    ...o.refs.map((f) => ({ inlineData: { mimeType: MIME[extname(f).toLowerCase()] ?? 'image/png', data: readFileSync(f).toString('base64') } })),
    { text: o.prompt },
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${o.model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: o.aspect, imageSize: o.size } },
    }),
  });
  const j = (await res.json()) as {
    error?: { code: number; status: string; message: string };
    candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string }; text?: string }[] }; finishReason?: string }[];
    usageMetadata?: unknown;
  };
  if (!res.ok || j.error) throw new Error(`API エラー ${res.status}: ${j.error?.status} ${j.error?.message?.slice(0, 300)}`);
  const ps = j.candidates?.[0]?.content?.parts ?? [];
  const img = ps.find((p) => p.inlineData)?.inlineData;
  if (!img) throw new Error(`画像が返ってこなかった（${j.candidates?.[0]?.finishReason}）: ${ps.map((p) => p.text).join(' ').slice(0, 300)}`);
  // 返ってきた形式（PNG / JPEG）に合わせて拡張子をそろえる
  const ext = img.mimeType === 'image/jpeg' ? '.jpg' : img.mimeType === 'image/webp' ? '.webp' : '.png';
  const file = o.out.replace(/\.(png|jpe?g|webp)$/i, '') + ext;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(img.data, 'base64'));
  console.log(`保存: ${file}（${img.mimeType}、モデル ${o.model}）`);
  if (j.usageMetadata) console.log('使用量:', JSON.stringify(j.usageMetadata));
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
