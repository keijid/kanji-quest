'use client';
// 中ボス：地図で つぎの ステージの 字を えらぶと、いきなり 画面が ゆれて とび出してくる（lib/midboss.ts）
// 「たたかう！」で 中ボスせんへ。「あとで」なら 地図に もどるが、つぎに 字を えらぶと また あらわれる
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Mk } from '@/components/ui';
import type { AppData } from '@/lib/hooks';
import { useGame } from '@/lib/game';
import { midBossCount, midBossSet, midBossStages, pendingMidBoss, type MidBoss } from '@/lib/midboss';
import { preloadVoice, sfx, voice } from '@/lib/sfx';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * 字を えらんだ ときに 通す 関所。gate(その字の ステージ, ふだんの 動き)：
 * 中ボスが 待っていて、その字が 中ボスより 先の ステージなら、ふだんの 動きの かわりに 中ボスを 出す
 */
export function useMidBossGate(d: AppData | undefined) {
  const router = useRouter();
  const startSet = useGame((s) => s.startSet);
  const [shown, setShown] = useState<MidBoss | null>(null);
  const mb = d ? pendingMidBoss(d.bossCleared, d.midCleared) : null;
  // あらわれたら ジャジャーンの あとに せりふを しゃべる（声は 先に 読みこんで おく）
  const mbId = mb?.id;
  useEffect(() => { if (mbId) preloadVoice(`mid-${mbId}`); }, [mbId]);

  const gate = (stage: number, go: () => void) => {
    if (mb && stage > mb.after) { sfx('ambush'); voice(`mid-${mb.id}`, 0.9); setShown(mb); } else go();
  };
  const fight = () => {
    if (!d || !shown) return;
    startSet(midBossSet(shown, (c) => d.progress.get(c)?.hist, new Set(d.weak)));
    router.push('/play/');
  };
  const popup = shown && <MidBossAmbush mb={shown} onFight={fight} onLater={() => setShown(null)} />;
  return { gate, popup };
}

function MidBossAmbush({ mb, onFight, onLater }: { mb: MidBoss; onFight: () => void; onLater: () => void }) {
  const stages = midBossStages(mb);
  return (
    <div className="animate-flash fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4">
      <div className="animate-shake flex w-full max-w-[560px] flex-col items-center gap-2">
        <div className="animate-poyon rounded-2xl border-4 border-ink bg-primary px-5 py-1 font-yusei text-[clamp(28px,5vw,40px)] text-paper shadow-hard-6">
          <Mk>{'{中:ちゅう}ボスが あらわれた！'}</Mk>
        </div>
        <div className="relative">
          <span className="animate-poyon absolute -left-10 top-0 z-[1] font-yusei text-[96px] leading-none text-gold drop-shadow-[4px_4px_0_#3a2614]" style={{ animationDelay: '0.5s' }} aria-hidden>！</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE}/bosses/mid-${mb.id}.png`} alt={mb.name} className="animate-ambush h-[min(300px,42vh)] w-[min(300px,42vh)] max-w-none drop-shadow-[4px_6px_0_rgba(58,38,20,.35)]" />
        </div>
        <div className="animate-poyon flex w-full flex-col gap-3 rounded-[22px] border-4 border-ink bg-card px-6 py-4 shadow-hard-8" style={{ animationDelay: '0.7s' }}>
          <div className="text-center font-yusei text-[22px] text-boss">{mb.name}</div>
          <div className="text-center text-[18px] leading-relaxed"><Mk>{mb.line}</Mk></div>
          <div className="text-center text-[15px] text-frame">
            <Mk>{`ステージ${Math.min(...stages)}〜${Math.max(...stages)}の かん字から ${midBossCount(mb)}もん。8わり せいかいで たおせる！`}</Mk>
          </div>
          <Btn tone="red" shadow={5} className="min-h-[64px] font-yusei text-[28px]" onClick={onFight}>たたかう！</Btn>
          <button onClick={() => { sfx('tap'); onLater(); }} className="mx-auto min-h-11 px-4 text-[15px] text-frame underline">あとで</button>
        </div>
      </div>
    </div>
  );
}
