import { BackBtn } from '@/components/ui';

export const metadata = { title: 'クレジット・ライセンス｜カンジクエスト' };

export default function Credits() {
  return (
    <div data-screen-label="クレジット" className="flex flex-1 flex-col gap-[18px] px-[clamp(16px,2.4vw,28px)] pb-20 pt-4">
      <div className="flex items-center gap-[14px]">
        <BackBtn href="/parent/" />
        <div className="text-[clamp(22px,2.6vw,28px)]">クレジット・ライセンス</div>
      </div>
      <div className="flex max-w-[760px] flex-col gap-4 rounded-2xl border-[3px] border-ink bg-card p-6 text-base leading-relaxed">
        <section>
          <h2 className="mb-1 text-lg">書き順・字形データ：KanjiVG</h2>
          <p>
            漢字とひらがなの書き順・字形のデータ（書き順アニメ、筆順・画数の問題、手書きの自動判定のお手本）には{' '}
            <a href="https://kanjivg.tagaini.net/" target="_blank" rel="noreferrer">KanjiVG</a>{' '}
            を使用しています。KanjiVG is copyright Ulrich Apel and released under the{' '}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">Creative Commons Attribution-Share Alike 3.0</a> license.
          </p>
          <p className="mt-1 text-sm text-frame">
            本アプリでは、KanjiVG の SVG から画ごとのパスだけを取り出し、1 つの JSON にまとめて利用しています（変更点）。このデータは同じ CC BY-SA 3.0 で提供されます。
          </p>
        </section>
        <section>
          <h2 className="mb-1 text-lg">フォント</h2>
          <p>Yusei Magic、Kiwi Maru、Klee One（SIL Open Font License 1.1）</p>
        </section>
        <section>
          <h2 className="mb-1 text-lg">データの保存</h2>
          <p>名前や学習の記録は、この端末の中（IndexedDB）にだけ保存されます。外部には送信しません。</p>
        </section>
      </div>
    </div>
  );
}
