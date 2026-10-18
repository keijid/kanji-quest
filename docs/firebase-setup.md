# Firebase の準備（Google ログイン・クラウド保存・公開先）

> 2026-10-18 に設定ずみ（プロジェクト ID：`kanji-quest-c6be1`、公開先：https://kanji-quest-c6be1.web.app）。作り直すときの手順として残しています。
> つまずいた点：サービスアカウントには、下の3つに加えて **Service Usage ユーザー**（Service Usage Consumer）のロールも必要。`apiKey` は設定画面の伏せ字（••••）ではなく、「SDK の設定と構成」→「構成」の値をコピーする。

アプリのコードはできています。Firebase のプロジェクト作成と GitHub への登録は、アカウントの持ち主の作業が必要なので、この手順でお願いします。
終わると、`main` への push で **https://＜プロジェクトID＞.web.app** に公開され、Google ログインが必須になります（GitHub Pages への公開は止まります）。

所要時間：20〜30分

---

## 1. プロジェクトを作る

1. https://console.firebase.google.com を開き「プロジェクトを作成」
2. 名前は `kanji-quest` など。**プロジェクト ID**（例：`kanji-quest-1a2b3`）を控える
3. Google アナリティクスは「オフ」でよい

## 2. Google ログインを有効にする

1. 左のメニュー「構築」→「Authentication」→「始める」
2. 「Sign-in method」タブ →「Google」→「有効にする」
3. 「プロジェクトのサポートメール」を選んで「保存」

## 3. Firestore（クラウドのデータベース）を作る

1. 「構築」→「Firestore Database」→「データベースを作成」
2. 「本番環境モード」を選ぶ（読み書きのルールは、このリポジトリの `firestore.rules` を公開時に自動で入れます。ログインした本人の記録だけを読み書きできるルールです）
3. ロケーションは **asia-northeast1（東京）**

## 4. Hosting（公開先）を有効にする

1. 「構築」→「Hosting」→「始める」
2. 出てくるコマンドの手順は**飛ばして**「次へ」で最後まで進める（公開は GitHub Actions が行います）

## 5. ウェブアプリを登録して、設定の値を控える

1. 歯車アイコン →「プロジェクトの設定」→「マイアプリ」の `</>`（ウェブ）
2. ニックネームは `kanji-quest`。「Firebase Hosting も設定」のチェックは不要 →「アプリを登録」
3. 表示される `firebaseConfig` のうち、次の値を控える
   - `apiKey` / `appId` / `messagingSenderId` / `storageBucket`（`projectId` は 1. のもの）

> これらはアプリに埋め込まれて公開される値で、秘密ではありません（守りは Firestore のルールが担います）。

## 6. ログイン画面をアプリと同じドメインで出す設定

iPad のホーム画面アプリでもログインできるよう、ログイン画面を `＜プロジェクトID＞.web.app` で出します。そのための許可を1つ追加します。

1. https://console.cloud.google.com/apis/credentials を開く（上のプロジェクト選択で、1. のプロジェクトを選ぶ）
2. 「OAuth 2.0 クライアント ID」の **Web client (auto created by Google Service)** を開く
3. 「承認済みのリダイレクト URI」に次を追加して「保存」
   ```
   https://＜プロジェクトID＞.web.app/__/auth/handler
   ```

## 7. GitHub Actions から公開できるようにする（サービスアカウント）

1. Firebase の「プロジェクトの設定」→「サービス アカウント」→「新しい秘密鍵を生成」→ JSON ファイルが保存される
2. https://console.cloud.google.com/iam-admin/iam で、`firebase-adminsdk-…@…iam.gserviceaccount.com` の行の鉛筆アイコン →「別のロールを追加」で次の3つを追加して保存
   - Firebase Hosting 管理者
   - Firebase Rules 管理者
   - API キー閲覧者
   - Service Usage ユーザー
3. ターミナルで、JSON を GitHub のシークレットに登録し、**登録したら JSON ファイルは消す**
   ```bash
   gh secret set FIREBASE_SERVICE_ACCOUNT --repo keijid/kanji-quest < ~/Downloads/＜保存されたファイル名＞.json
   ```

## 8. GitHub に設定の値を登録する

5. で控えた値を、リポジトリ変数として登録します（ターミナルで1行ずつ）。

```bash
gh variable set FIREBASE_PROJECT_ID --repo keijid/kanji-quest --body "＜プロジェクトID＞"
gh variable set FIREBASE_API_KEY --repo keijid/kanji-quest --body "＜apiKey＞"
gh variable set FIREBASE_APP_ID --repo keijid/kanji-quest --body "＜appId＞"
gh variable set FIREBASE_MESSAGING_SENDER_ID --repo keijid/kanji-quest --body "＜messagingSenderId＞"
gh variable set FIREBASE_STORAGE_BUCKET --repo keijid/kanji-quest --body "＜storageBucket＞"
```

`FIREBASE_PROJECT_ID` が登録されると、次の公開から Firebase Hosting に切りかわります。

## 9. 公開する

```bash
gh workflow run deploy.yml --repo keijid/kanji-quest
```

終わったら https://＜プロジェクトID＞.web.app を開いて、Google でログインできるか確かめてください。iPad では、Safari で開いて「ホーム画面に追加」し、ホーム画面のアイコンから開いてログインできるかも確かめてください。

---

## 手元で動かすとき

- Firebase なし（今までどおり端末の中だけ）：`npm run dev`
- 本物の Firebase につなぐ：`.env.local` に次を書いて `npm run dev`（`.env.local` は git に入りません）
  ```
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=＜プロジェクトID＞
  NEXT_PUBLIC_FIREBASE_API_KEY=＜apiKey＞
  NEXT_PUBLIC_FIREBASE_APP_ID=＜appId＞
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=＜プロジェクトID＞.firebaseapp.com
  ```
- エミュレーター（本物のアカウントなし）：`npx firebase-tools emulators:start --only auth --project demo-kanji-quest` を動かしたまま、`NEXT_PUBLIC_FIREBASE_EMULATOR=1` などを付けて `next dev`（`.claude/launch.json` の `dev-firebase-emu` と同じ）。ブラウザのコンソールで `__kqEmuSignIn('a@example.test')` を呼ぶとログインでき、クラウドの代わりに localStorage に保存されます。

## しくみ（メモ）

- 画面は今までどおり端末の IndexedDB を読み書きし、変わった行だけを Firestore（`users/{uid}/{テーブル}/{キー}`）に書きます（`lib/cloud/sync.ts`）。オフラインの間の変更は、つながったときに送られます。
- ログインしたとき：クラウドに記録があれば端末に読みこむ／なければ端末の記録を上げる（前に別の人が使っていた端末なら上げずに消す）。
- ログアウト：端末の記録を消す（クラウドには残る）。保護者画面の「記録を消す」はクラウドの記録も消します。
