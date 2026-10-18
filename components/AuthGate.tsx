'use client';
// ログインが必須のときの入口。ログインして、クラウドの記録を端末に読みこんでから画面を出す
import { useEffect, useState, type ReactNode } from 'react';
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { create } from 'zustand';
import { Btn } from '@/components/ui';
import { PartnerAvatar } from '@/components/Partner';
import { firebaseEnabled, getFirebase, signInWithGoogle } from '@/lib/cloud/firebase';
import { startSync } from '@/lib/cloud/sync';
import { PARTNER_IDS } from '@/lib/partners';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** ログイン中のアカウント（保護者画面で表示する） */
export const useAuthUser = create<{ email: string | null; set: (email: string | null) => void }>()((set) => ({
  email: null,
  set: (email) => set({ email }),
}));

type Status = 'loading' | 'out' | 'syncing' | 'ready' | 'error';

export function AuthGate({ children }: { children: ReactNode }) {
  if (!firebaseEnabled) return <>{children}</>;
  return <Gate>{children}</Gate>;
}

function Gate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const setEmail = useAuthUser((s) => s.set);

  useEffect(() => {
    const { auth, backend } = getFirebase();
    // 画面切りかえ型のログインから戻ってきたときの結果を受け取る（失敗したら知らせる）
    getRedirectResult(auth).catch((e) => {
      console.error(e);
      setMessage('ログインできませんでした。もう いちど ためしてね。');
      setStatus('error');
    });
    return onAuthStateChanged(auth, async (user) => {
      setEmail(user?.email ?? null);
      if (!user) { setStatus('out'); return; }
      setStatus('syncing');
      try {
        await startSync(user.uid, backend);
        setStatus('ready');
      } catch (e) {
        console.error(e);
        setMessage('きろくを よみこめませんでした。インターネットに つないで もう いちど ためしてね。');
        setStatus('error');
      }
    });
  }, [setEmail]);

  if (status === 'ready') return <>{children}</>;
  if (status === 'out' || status === 'error') return <LoginScreen message={message} onError={setMessage} />;
  return (
    <div className="flex flex-1 items-center justify-center text-xl text-frame" role="status">
      {status === 'syncing' ? 'きろくを よみこんでいるよ…' : 'じゅんびちゅう…'}
    </div>
  );
}

function LoginScreen({ message, onError }: { message: string; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true);
    onError('');
    try {
      await signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error(e);
        onError('ログインできませんでした。もう いちど ためしてね。');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-screen-label="ログイン" className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BASE}/title.png`} alt="カンジクエスト" className="block h-[clamp(48px,6.5vw,80px)] w-auto max-w-full" />
      <div className="flex items-end gap-4">
        {PARTNER_IDS.map((id) => <PartnerAvatar key={id} id={id} size={110} />)}
      </div>
      <div className="font-yusei text-[clamp(22px,3vw,30px)]">おうちの人と いっしょに ログインしてね</div>
      <Btn tone="red" shadow={5} onClick={login} disabled={busy} className="flex h-[72px] min-w-[300px] items-center justify-center gap-3 px-6 font-yusei text-2xl">
        <GoogleMark />
        {busy ? 'まってね…' : 'Google で ログイン'}
      </Btn>
      {message && <div className="rounded-[14px] border-2 border-dashed border-gold bg-hint px-4 py-2 text-base">{message}</div>}
      <p className="max-w-[520px] text-sm leading-relaxed text-frame">
        保護者の方へ：学習の記録を保存し、ほかの端末でも続きから使えるようにするため、保護者の方の Google アカウントでログインしてください。記録はこのアカウントにだけ保存されます。
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden className="flex-none rounded-full bg-white p-[3px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
