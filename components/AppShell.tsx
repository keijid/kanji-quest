'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { addStudySeconds } from '@/lib/progress';
import { setSfxEnabled, unlockSfx } from '@/lib/sfx';
import { installPalmRejection } from '@/lib/palm';
import { AuthGate } from './AuthGate';

const TICK = 15; // 秒
const NO_PROFILE_OK = ['/onboard', '/credits'];

export function AppShell({ children }: { children: ReactNode }) {
  // Firebase の設定があるときはログイン必須。ログインして記録を読みこむまで、画面は出さない
  return (
    <AuthGate>
      <Shell>{children}</Shell>
    </AuthGate>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const lastInput = useRef(0);
  const router = useRouter();
  const path = usePathname();
  const meta = useLiveQuery(() => db.meta.get('main'), []);
  const profile = useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);

  useEffect(() => { setSfxEnabled(meta?.settings.sfx ?? true); }, [meta?.settings.sfx]);

  // 名前・相棒がまだなければ「はじめて」へ
  useEffect(() => {
    // 「/」は app/page.tsx が振り分けるので、ここでは何もしない（2か所から同時に移動しないように）
    if (profile === null && path !== '/' && !NO_PROFILE_OK.some((p) => path.startsWith(p))) router.replace('/onboard/');
  }, [profile, path, router]);

  useEffect(() => { installPalmRejection(); }, []);

  useEffect(() => {
    const onInput = () => { lastInput.current = Date.now(); unlockSfx(); };
    window.addEventListener('pointerdown', onInput, { passive: true });
    // iOS は 指を はなしたとき（pointerup・touchend）でないと 音を 出しはじめられない
    window.addEventListener('pointerup', unlockSfx, { passive: true });
    window.addEventListener('touchend', unlockSfx, { passive: true });
    // 画面が見えていて、1分以内にさわっていたら学習時間に足す（保護者画面は数えない）
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastInput.current > 60_000) return;
      if (location.pathname.includes('/parent')) return;
      void addStudySeconds(TICK);
    }, TICK * 1000);
    return () => {
      window.removeEventListener('pointerdown', onInput);
      window.removeEventListener('pointerup', unlockSfx);
      window.removeEventListener('touchend', unlockSfx);
      clearInterval(id);
    };
  }, []);

  return <>{children}</>;
}
