# カンジクエスト

小学2〜3年生向けの、漢字検定9級（小1・小2配当の240字）の学習アプリです。冒険マップを進みながら「よみ／かき／かきじゅん・かくすう／おくりがな」を手書きで学びます。

- 公開先：https://keijid.github.io/kanji-quest/ （iPad の Safari で開き「ホーム画面に追加」）
- ログインなし。名前と学習の記録は端末の中（IndexedDB）にだけ保存します
- 一度開けばオフラインでも使えます（Service Worker）

## 技術

Next.js（App Router・静的書き出し）+ React + TypeScript + Tailwind CSS v4 / Dexie（IndexedDB）/ Zustand / Serwist（PWA）

## 開発

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 手書き判定のテスト
npm run typecheck
```

GitHub Pages と同じ形（/kanji-quest 配下）でビルドするには：

```bash
NEXT_PUBLIC_BASE_PATH=/kanji-quest npm run build   # out/ に書き出し
```

`main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）が GitHub Pages に公開します。

## データ

| ファイル | 中身 |
|---|---|
| `data/kanji-list.ts` | 240字と並び順（10字ずつ24ステージ。1〜8が小1、9〜24が小2） |
| `data/kanji-source.txt` | 読み・画数・部首・ことば・問題文の元データ（手で書く） |
| `data/kanji.json` | ↑ をチェックして書き出したもの（`npm run data`。一覧表 `data/kanji-table.md` も出る） |
| `data/strokes.json` | KanjiVG から取り出した書き順のパス（`npm run data:kanjivg`） |

`npm run data` は、画数が KanjiVG と合うか、例文・ことばに小2までに習わない漢字がないか、ふりがなの付け忘れがないか、などを確かめます。

## 手書きの自動判定

`lib/recognize/` — KanjiVG のお手本と形だけを比べます（書き順・画の向きは見ない）。大きさと位置をそろえ、向きつきの chamfer 距離で240字（ひらがなは約80字）の中の順位を出し、甘めの条件で正解にします。しきい値は `scripts/calibrate-recognizer.ts` で調整し、`tests/recognize.test.ts` で確認しています。

## 差し替える素材

- 相棒のイラスト（3体×5段階）：5段階を横に並べた1枚絵を `assets/partners-src/<fire|wood|light>-sheet.jpg` に置き、`npm run partners` で `public/partners/<id>-<1..5>.png`（背景透過・384px）に切り分けます
- アプリアイコン：元の絵 `assets/icon-src.jpg`（正方形）を置きかえて `npm run icons`（`public/icons/` に各サイズを書き出す）
- タイトル文字：元の絵 `assets/title-src.jpg`（白い背景）を置きかえて `npm run title`（背景を切り抜いて `public/title.png` に書き出す）
- 効果音：`public/sfx/README.md`

## ライセンス・クレジット

- 書き順データ：[KanjiVG](https://kanjivg.tagaini.net/)（CC BY-SA 3.0）。`data/strokes.json` は CC BY-SA 3.0（`data/LICENSE-KanjiVG.md`）
- フォント：Yusei Magic / Kiwi Maru / Klee One（SIL Open Font License 1.1）
