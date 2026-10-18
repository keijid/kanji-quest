// Firebase（Google ログインと Firestore）。設定はビルド時の環境変数（公開してよい値）で渡す。
// 設定がなければ firebaseEnabled = false で、これまでどおり端末の中だけで動く。
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  signInWithPopup,
  signInWithCredential,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { LocalStorageBackend, type CloudBackend } from './backend';
import { FirestoreBackend } from './firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

/** 開発用：Auth エミュレーター＋ localStorage を「クラウド」にする（NEXT_PUBLIC_FIREBASE_EMULATOR=1） */
const EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1';

export const firebaseEnabled = Boolean(config.apiKey && config.projectId);

let cached: { app: FirebaseApp; auth: Auth; backend: CloudBackend; firestore: Firestore | null } | null = null;

/** ブラウザの中でだけ呼ぶ */
export function getFirebase() {
  if (!firebaseEnabled) throw new Error('Firebase の設定がない');
  if (cached) return cached;
  const app = initializeApp(config);
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  let firestore: Firestore | null = null;
  let backend: CloudBackend;
  if (EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    backend = new LocalStorageBackend();
    // 開発用：エミュレーターの仮の Google アカウントでログインする（ブラウザのコンソールから呼ぶ）
    (window as unknown as { __kqEmuSignIn?: (email: string) => Promise<unknown> }).__kqEmuSignIn = (email) =>
      signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
  } else {
    // オフラインでも書けるよう、端末にもキャッシュする（書いた分はつながったときに送られる）
    firestore = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    backend = new FirestoreBackend(firestore);
  }
  cached = { app, auth, backend, firestore };
  return cached;
}

/**
 * Google でログイン。
 * アプリと同じドメインでログイン画面を出せるとき（Firebase Hosting）は画面ごと切りかえる（iPad のホーム画面アプリでも動く）。
 * それ以外（ドメインがちがうとき）はポップアップ。
 */
export async function signInWithGoogle() {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // エミュレーターも画面切りかえ型で動く（本番の Firebase Hosting と同じ流れを試せる）
  const redirect = EMULATOR || config.authDomain === location.host;
  if (redirect) await signInWithRedirect(auth, provider);
  else await signInWithPopup(auth, provider);
}

export async function signOut() {
  await fbSignOut(getFirebase().auth);
}
