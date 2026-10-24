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
import { midBossOf, midBossSet } from '@/lib/midboss';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const KIND_TITLE = { read: '読み', write: '書き', stroke: '書きじゅん・画数', okuri: 'おくりがな', boss: 'ボスせん', midboss: '{中:ちゅう}ボスせん', review: 'ふくしゅう', lesson: 'れんしゅう' } as const;

export default function Result() {
  const router = useRouter();
  const d = useAppData();
  const r = useGame((s) => s.result);
  const startLesson = useGame((s) => s.startLesson);
  const startSet = useGame((s) => s.startSet);
  const [showEvolve, setShowEvolve] = useState(false);

  const before = r ? evolution(r.practicedBefore ?? r.learnedBefore) : null;
  const after = r ? evolution(r.practicedAfter ?? r.learnedAfter) : null;
  const evolved = !!before && !!after && after.stage > before.stage;

  // 最初の描画はサーバー側の初期値（null）なので、実際の値を見てから判断する
  useEffect(() => { if (!useGame.getState().result) router.replace('/home/'); }, [r, router]);
  useEffect(() => { if (evolved) { setShowEvolve(true); sfx('evolve'); } }, [evolved]);
  if (!r || !d?.profile || !after) return null;

  const p = PARTNERS[d.profile.partner];
  const correct = r.logs.filter((l) => l.outcome > 0).length;
  const total = r.set.questions.length;
  const kindTitle = r.set.kind === 'lesson' ? `「{${r.set.char}:}」の れんしゅう` : KIND_TITLE[r.set.kind];
  const where = r.set.stage ? `${STAGE_NAMES[r.set.stage - 1]} ・ ${kindTitle}` : kindTitle;
  // 1字ずつの練習のあと：同じステージで、まだ練習していない つぎの字（なければボスせん）
  const nextChar = r.set.kind === 'lesson' && r.set.stage ? stageKanji(r.set.stage).map((k) => k.char).find((c) => !d.practicedSet.has(c)) : undefined;
  const mid = r.set.kind === 'midboss' && r.set.mid ? midBossOf(r.set.mid) : null;
  // 中ボスせんの あと：たおしたら 今の ステージの つぎの字へ（ぼうけんの つづき）、まけたら もう一回
  const curNext = stageKanji(d.current).map((k) => k.char).find((c) => !d.practicedSet.has(c));
  const goNext = r.set.kind === 'lesson' && r.set.stage
    ? nextChar
      ? { label: `つぎの字「{${nextChar}:}」へ`, go: () => { startLesson(nextChar); router.push('/lesson/'); } }
      : { label: 'ボスせんへ', go: () => router.push(`/stage/${r.set.stage}/`) }
    : mid
      ? r.bossCleared
        ? curNext
          ? { label: `ぼうけんの つづき「{${curNext}:}」へ`, go: () => { startLesson(curNext); router.push('/lesson/'); } }
          : null
        : { label: 'もう一回 ちょうせん', go: () => { startSet(midBossSet(mid, (c) => d.progress.get(c)?.hist, new Set(d.weak))); router.push('/play/'); } }
      : null;

  return (
    <div data-screen-label="06 けっか" className="flex flex-1 flex-wrap content-center gap-5 px-[clamp(16px,2.4vw,28px)] pb-20 pt-6">
      <Card shadow={6} className="flex flex-[1_1_380px] flex-col items-center gap-[14px] rounded-[22px] p-7">
        <div className="text-lg text-frame"><Mk>{where}</Mk></div>
        <div className="font-yusei text-[44px]">{mid ? (r.bossCleared ? <Mk>{'{中:ちゅう}ボスを たおした！'}</Mk> : 'おしい！') : r.bossCleared ? 'ステージ クリア！' : r.set.kind === 'lesson' ? `「${r.set.char}」 れんしゅう できた！` : 'よく がんばった！'}</div>
        {/* ボスに かったら、ボス（お父さん・お母さん）が ニッコリ */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {r.bossCleared && r.set.stage && <img src={`${BASE}/bosses/stage-${r.set.stage}-happy.png`} alt="" className="animate-poyon -my-2 h-[180px] w-[180px]" />}
        {/* 中ボス：たおしたら おまわりさんは ニコッ、インフルエンサーは 大わらい。まけたら おこった まま */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {mid && <img src={`${BASE}/bosses/mid-${mid.id}${r.bossCleared ? '-happy' : ''}.png`} alt={mid.name} className="animate-poyon -my-2 h-[200px] w-[200px]" />}
        {mid && !r.bossCleared && <div className="text-[17px] text-frame"><Mk>8わり せいかいで たおせるよ。にがての 字を ふくしゅう してから でも いいよ</Mk></div>}
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
              {after.final ? (after.remaining ? <>ぜんぶ まで あと {after.remaining}<Mk>字</Mk></> : 'ぜんぶ れんしゅう した！') : <>しんか {after.stage + 1}まで あと {after.remaining}<Mk>字</Mk></>}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-[1_1_320px] flex-col gap-4">
        {/* まちがえても ここでは 練習させない（ぜんもん せいかいの ときだけ ほめる） */}
        {correct === total && (
          <Card shadow={6} className="flex flex-col items-center gap-2 rounded-[22px] p-[22px]">
            <div className="font-yusei text-[32px] text-success">ぜんもん せいかい！</div>
          </Card>
        )}
        {goNext && <Btn tone="red" className="min-h-[64px] font-yusei text-[24px]" onClick={goNext.go}><Mk>{goNext.label}</Mk></Btn>}
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
