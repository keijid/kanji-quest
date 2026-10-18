'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Card, Mk, Modal, ProgressBar } from '@/components/ui';
import { PartnerAvatar } from '@/components/Partner';
import { useAppData } from '@/lib/hooks';
import { useGame } from '@/lib/game';
import { STAGE_NAMES, stageKanji } from '@/lib/data';
import { evolution, PARTNERS } from '@/lib/partners';
import { sfx } from '@/lib/sfx';
import { LevelUp } from '@/components/LevelUp';

const KIND_TITLE = { read: '読み', write: '書き', stroke: '書きじゅん・画数', okuri: 'おくりがな', boss: 'ボスせん', review: 'ふくしゅう', lesson: 'れんしゅう' } as const;

export default function Result() {
  const router = useRouter();
  const d = useAppData();
  const r = useGame((s) => s.result);
  const startPractice = useGame((s) => s.startPractice);
  const startLesson = useGame((s) => s.startLesson);
  const [showEvolve, setShowEvolve] = useState(false);

  const before = r ? evolution(r.learnedBefore) : null;
  const after = r ? evolution(r.learnedAfter) : null;
  const evolved = !!before && !!after && after.stage > before.stage;

  // 最初の描画はサーバー側の初期値（null）なので、実際の値を見てから判断する
  useEffect(() => { if (!useGame.getState().result) router.replace('/home/'); }, [r, router]);
  useEffect(() => { if (evolved) { setShowEvolve(true); sfx('evolve'); } }, [evolved]);
  if (!r || !d?.profile || !after) return null;

  const p = PARTNERS[d.profile.partner];
  const correct = r.logs.filter((l) => l.outcome > 0).length;
  const total = r.set.questions.length;
  const wrong = [...new Set(r.logs.filter((l) => l.outcome === 0).map((l) => l.char))];
  const kindTitle = r.set.kind === 'lesson' ? `「{${r.set.char}:}」の れんしゅう` : KIND_TITLE[r.set.kind];
  const where = r.set.stage ? `${STAGE_NAMES[r.set.stage - 1]} ・ ${kindTitle}` : kindTitle;
  // 1字ずつの練習のあと：同じステージで、まだ練習していない つぎの字（なければボスせん）
  const nextChar = r.set.kind === 'lesson' && r.set.stage ? stageKanji(r.set.stage).map((k) => k.char).find((c) => !d.practicedSet.has(c)) : undefined;
  const goNext = r.set.kind === 'lesson' && r.set.stage
    ? nextChar
      ? { label: `つぎの字「{${nextChar}:}」へ`, go: () => { startLesson(nextChar); router.push('/lesson/'); } }
      : { label: 'ボスせんへ', go: () => router.push(`/stage/${r.set.stage}/`) }
    : null;

  return (
    <div data-screen-label="06 けっか" className="flex flex-1 flex-wrap content-center gap-5 px-[clamp(16px,2.4vw,28px)] pb-20 pt-6">
      <Card shadow={6} className="flex flex-[1_1_380px] flex-col items-center gap-[14px] rounded-[22px] p-7">
        <div className="text-lg text-frame"><Mk>{where}</Mk></div>
        <div className="font-yusei text-[44px]">{r.bossCleared ? 'ステージ クリア！' : r.set.kind === 'lesson' ? `「${r.set.char}」 れんしゅう できた！` : 'よく がんばった！'}</div>
        <div className="flex gap-2.5 text-[56px] leading-none text-gold">
          {[0, 1, 2].map((i) => <span key={i} className="animate-poyon" style={{ color: i < r.stars ? '#c48a12' : '#d9c49a', animationDelay: `${i * 0.15}s` }}>★</span>)}
        </div>
        <div className="text-[22px]"><span className="text-5xl text-primary">{correct}</span> / {total} もん せいかい</div>
        <div className="flex w-full max-w-[420px] items-center gap-[14px] border-t-[3px] border-dashed border-dash pt-4">
          <PartnerAvatar id={d.profile.partner} size={84} stage={after.stage} mood={r.stars >= 2 ? 'happy' : 'cheer'} fontSize={12} />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="text-base">
              {r.newlyLearned.length ? <>{p.name}が よろこんでる！ ＋{r.newlyLearned.length}<Mk>字</Mk> おぼえた</> : <>{p.name}も おうえん してるよ！</>}
            </div>
            <ProgressBar value={after.ratio} color={p.color} />
            <div className="text-[13px] text-frame">
              {after.final ? (after.remaining ? <>ぜんぶ まで あと {after.remaining}<Mk>字</Mk></> : 'ぜんぶ おぼえた！') : <>しんか {after.stage + 1}まで あと {after.remaining}<Mk>字</Mk></>}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-[1_1_320px] flex-col gap-4">
        {wrong.length > 0 ? (
          <Card shadow={6} className="flex flex-col gap-[14px] rounded-[22px] p-[22px]">
            <div className="text-xl"><Mk>まちがえた かん字</Mk></div>
            <div className="flex flex-wrap gap-3">
              {wrong.map((c) => (
                <div key={c} className="flex h-[92px] w-[92px] items-center justify-center rounded-[14px] border-[3px] border-primary bg-cell font-klee text-[58px]">{c}</div>
              ))}
            </div>
            <div className="text-base leading-[1.6] text-frame"><Mk>お手本を 見て 5回ずつ 書いて おぼえよう</Mk></div>
            <Btn tone="red" className="min-h-[72px] font-yusei text-[26px]" onClick={() => { startPractice(wrong, '/result/'); router.push('/practice/'); }}><Mk>5回 れんしゅう</Mk></Btn>
          </Card>
        ) : (
          <Card shadow={6} className="flex flex-col items-center gap-2 rounded-[22px] p-[22px]">
            <div className="font-yusei text-[32px] text-success">ぜんもん せいかい！</div>
            <div className="text-base text-frame"><Mk>まちがえた かん字は ないよ</Mk></div>
          </Card>
        )}
        {goNext && <Btn tone={wrong.length ? 'card' : 'red'} className="min-h-[64px] font-yusei text-[24px]" onClick={goNext.go}><Mk>{goNext.label}</Mk></Btn>}
        <Btn className="min-h-[60px] text-lg" onClick={() => router.push('/home/')}><Mk>地図に もどる</Mk></Btn>
      </div>

      {showEvolve && (
        <Modal>
          <div className="font-yusei text-[44px]" style={{ color: p.color }}>しんか した！</div>
          <div className="animate-poyon"><PartnerAvatar id={d.profile.partner} size={160} stage={after.stage} mood="happy" label={`${p.kind}\nしんか ${after.stage}`} /></div>
          <div className="text-lg">{p.name}が しんか {after.stage}に なったよ！</div>
          <Btn tone="red" className="min-h-16 w-full font-yusei text-2xl" onClick={() => setShowEvolve(false)}>やったね！</Btn>
        </Modal>
      )}
      <LevelUp blocked={showEvolve} />
    </div>
  );
}
