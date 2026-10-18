'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

// 初回は「はじめて」、2回目以降は「ホーム」へ
export default function Index() {
  const router = useRouter();
  const profile = useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
  useEffect(() => {
    if (profile !== undefined) router.replace(profile ? '/home/' : '/onboard/');
  }, [profile, router]);
  return null;
}
