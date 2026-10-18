'use client';
// 10 保護者：計算ゲート → ダッシュボード。保護者画面は漢字かな交じり・ふりがななし
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { BackBtn } from '@/components/ui';
import { useAppData } from '@/lib/hooks';
import { TOTAL } from '@/lib/data';
import { db, today, type Mode, type Settings } from '@/lib/db';
import { resetAll } from '@/lib/progress';
import { shuffle } from '@/lib/quiz';
import { sfx } from '@/lib/sfx';
import { useAuthUser } from '@/components/AuthGate';
import { firebaseEnabled, signOut } from '@/lib/cloud/firebase';
import { stopSync } from '@/lib/cloud/sync';

const FIELDS: [Mode, string][] = [['read', '読み'], ['write', '書き取り'], ['okuri', '送りがな'], ['stroke', '筆順・画数']];
const DOW = ['月', '火', '水', '木', '金', '土', '日'];
const GOALS = [10, 15, 20, 30];
const LIMITS = [30, 45, 60, 90, 120];

function weekDates() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return DOW.map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return today(d); });
}

const fmtMin = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}時間${min % 60}分` : `${min}分`);

export default function Parent() {
  const router = useRouter();
  const d = useAppData();
  const email = useAuthUser((x) => x.email);
  const [ok, setOk] = useState(false);
  const gate = useMemo(() => {
    const a = 11 + Math.floor(Math.random() * 9), b = 3 + Math.floor(Math.random() * 7);
    const ans = a * b;
    return { a, b, ans, opts: shuffle([ans, ans + b, ans - b, ans + 10]) };
  }, []);
  const dates = useMemo(weekDates, []);
  const days = useLiveQuery(() => db.days.bulkGet(dates), [dates]);
  if (!d?.profile || !days) return null;

  const s = d.meta.settings;
  const setSettings = async (patch: Partial<Settings>) => {
    sfx('tap');
    await db.meta.put({ ...d.meta, settings: { ...s, ...patch } });
  };
  const cycle = <T,>(arr: T[], v: T) => arr[(arr.indexOf(v) + 1) % arr.length];

  const mins = days.map((x) => Math.round((x?.seconds ?? 0) / 60));
  const weekTotal = mins.reduce((a, b) => a + b, 0);
  const goalDays = mins.filter((m) => m >= s.goalMin).length;
  const weekAgo = Date.now() - 7 * 86400_000;
  const learnedThisWeek = [...d.progress.values()].filter((p) => p.learned && (p.learnedAt ?? 0) >= weekAgo).length;
  const top = Math.max(35, ...mins);

  const kpis = [
    { label: '覚えた漢字', value: `${d.learned} / ${TOTAL}字`, sub: `今週 +${learnedThisWeek}字` },
    { label: '今週の学習時間', value: fmtMin(weekTotal), sub: `目標 ${s.goalMin}分/日 を${goalDays}日達成` },
    { label: '連続学習', value: `${d.streak}日`, sub: `最長 ${d.meta.streak.best}日` },
    { label: '合格予想', value: `${d.prediction}%`, sub: d.bestFull ? `模擬テスト最高 ${d.bestFull.score} / ${d.bestFull.max}点` : '模擬テストは未受験' },
  ];

  const box = 'rounded-2xl border-[3px] border-ink bg-card p-[18px]';

  return (
    <div data-screen-label="10 保護者" className="flex flex-1 flex-col gap-[18px] px-[clamp(16px,2.4vw,28px)] pb-20 pt-4">
      <div className="flex items-center gap-[14px]">
        <BackBtn href="/home/" />
        <div className="text-[clamp(22px,2.6vw,28px)]">保護者の方へ</div>
      </div>

      {!ok ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[460px] flex-col items-center gap-4 rounded-[22px] border-[3px] border-ink bg-card p-7 shadow-hard-6">
            <div className="text-center text-base text-frame">保護者の方は、次の計算の答えを選んでください</div>
            <div className="text-5xl">{gate.a} × {gate.b} = ?</div>
            <div className="grid w-full grid-cols-2 gap-3">
              {gate.opts.map((v) => (
                <button key={v} className="min-h-16 rounded-[14px] border-[3px] border-ink bg-cell text-[26px]" onClick={() => (v === gate.ans ? setOk(true) : router.replace('/home/'))}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-[14px]" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            {kpis.map((k) => (
              <div key={k.label} className="flex flex-col gap-1 rounded-2xl border-[3px] border-ink bg-card p-4">
                <div className="text-sm text-frame">{k.label}</div>
                <div className="text-[30px]">{k.value}</div>
                <div className="text-[13px] text-success">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <div className={`${box} flex flex-[1_1_380px] flex-col gap-[14px]`}>
              <div className="text-[17px]">今週の学習時間（分）</div>
              <div className="flex h-[180px] items-end gap-3 border-b-2 border-ink px-1">
                {mins.map((m, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div className="text-xs text-frame">{m}</div>
                    <div className="w-full max-w-10 rounded-t-md border-2 border-b-0 border-ink" style={{ height: `${(m / top) * 100}%`, background: m >= s.goalMin ? '#5a8a3a' : '#c9a46a' }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 px-1">
                {DOW.map((l) => <div key={l} className="flex-1 text-center text-sm">{l}</div>)}
              </div>
            </div>
            <div className={`${box} flex flex-[1_1_300px] flex-col gap-3`}>
              <div className="text-[17px]">分野別の正答率</div>
              {FIELDS.map(([m, l]) => {
                const r = d.rates[m];
                const v = r === null ? null : Math.round(r * 100);
                return (
                  <div key={m} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[15px]"><span>{l}</span><span>{v === null ? '—' : `${v}%`}</span></div>
                    <div className="h-[14px] overflow-hidden rounded-[7px] border-2 border-ink bg-paper">
                      <div className="h-full" style={{ width: `${v ?? 0}%`, background: v !== null && v < 75 ? '#b8321f' : '#5a8a3a' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className={`${box} flex flex-[1_1_300px] flex-col gap-3`}>
              <div className="text-[17px]">苦手な漢字（5回書き練習の対象）</div>
              <div className="flex flex-wrap gap-2">
                {d.weak.length === 0 && <div className="text-[15px] text-frame">今は苦手な漢字はありません</div>}
                {d.weak.map((c) => <div key={c} className="flex h-14 w-14 items-center justify-center rounded-[10px] border-2 border-primary bg-cell font-klee text-[32px]">{c}</div>)}
              </div>
            </div>
            <div className={`${box} flex flex-[1_1_300px] flex-col gap-3`}>
              <div className="text-[17px]">設定</div>
              {[
                { l: '1日の目標時間', v: `${s.goalMin}分`, on: () => setSettings({ goalMin: cycle(GOALS, s.goalMin) }) },
                { l: '1日の利用上限', v: `${s.limitMin}分`, on: () => setSettings({ limitMin: cycle(LIMITS, s.limitMin) }) },
                { l: '効果音', v: s.sfx ? 'オン' : 'オフ', on: () => setSettings({ sfx: !s.sfx }) },
              ].map((t) => (
                <div key={t.l} className="flex min-h-11 items-center justify-between gap-3 border-t border-dashed border-dash pt-2">
                  <span className="text-[15px]">{t.l}</span>
                  <button onClick={t.on} className="min-h-10 rounded-[10px] border-2 border-ink bg-cell px-[14px] py-1.5 text-[15px]">{t.v}</button>
                </div>
              ))}
              <div className="flex min-h-11 items-center justify-between gap-3 border-t border-dashed border-dash pt-2 text-[15px]">
                <Link href="/credits/">クレジット・ライセンス</Link>
                <button
                  className="min-h-10 rounded-[10px] border-2 border-primary bg-cell px-[14px] py-1.5 text-primary"
                  onClick={async () => {
                    if (!confirm(firebaseEnabled ? 'この端末とクラウドの学習記録をすべて消します。元に戻せません。よろしいですか？' : 'この端末の学習記録をすべて消します。元に戻せません。よろしいですか？')) return;
                    await resetAll();
                    sessionStorage.clear();
                    router.replace('/onboard/');
                  }}
                >記録を消す</button>
              </div>
              <div className="text-xs text-frame">利用上限をこえると、ホームに休憩をすすめる表示が出ます（使えなくはなりません）。</div>
              {firebaseEnabled && (
                <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-dashed border-dash pt-2 text-[15px]">
                  <span className="break-all">ログイン中：{email ?? '—'}</span>
                  <button
                    className="min-h-10 rounded-[10px] border-2 border-ink bg-cell px-[14px] py-1.5"
                    onClick={async () => {
                      if (!confirm('ログアウトしますか？ 学習の記録はクラウドに保存されているので、もう一度ログインすれば続きから使えます。')) return;
                      await stopSync();
                      await signOut();
                      sessionStorage.clear();
                      router.replace('/');
                    }}
                  >ログアウト</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
