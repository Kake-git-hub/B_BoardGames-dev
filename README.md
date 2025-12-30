# B_BoardGames

対面で集まって遊ぶボードゲームを、各自スマホのブラウザで補助するための最小アプリです（現在: ワードウルフ / コードネーム / ラブレター）。

- ゲームマスター（GM）が設定 → ルーム作成 → QR生成
- 参加者はQRを読み取って参加
- 役職（多数/少数）とワードを各端末に表示
- トークタイマー表示
- 逆転ありの場合: 開示後に少数側が「多数側ワード」を入力して判定

## 1) 事前準備（無料）

このアプリは静的ファイルだけで動きますが、**全員オンライン前提**の同期に Firebase Realtime Database を使います（無料枠あり）。

### Firebase プロジェクト作成

1. Firebase Console でプロジェクト作成
2. Realtime Database を作成（テストモードでOK）
3. Web アプリを追加して「Firebase SDK の設定（構成）」をコピー
4. このアプリ側の「セットアップ」画面に、コピーした JSON を貼り付けて保存

> 旧方式（`src/config.js` を作る）も使えますが、配布を簡単にするため現在は「貼り付け保存」を推奨しています。

### Firebase設定をコードに組み込みたい場合（ブラウザ設定不要）

- [bbg-config.js](bbg-config.js) を開き、`ENABLE_EMBEDDED_FIREBASE_CONFIG = true` にする
- Firebase Console の `firebaseConfig` オブジェクトを貼り付け

これで `?screen=setup` を使わなくても動作します（配布先URLに設定が固定されます）。

### Realtime Database ルール（最低限）

開発用の最低限です。用途に合わせて強化してください。

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## 2) 起動（ローカル）

`file://` 直開きだと Firebase 読み込みが失敗することがあるため、ローカルサーバーで開いてください。

PowerShell 例（Python がある場合）:

```powershell
cd "c:\Users\B\Desktop\自作ソフト\B_BoardGames"
python -m http.server 8000
```

その後、PCで `http://localhost:8000/` を開きます。

> 注意: 参加者のスマホが `localhost` にアクセスすることはできません。
> 「全員オンライン前提」で使うなら、次の「GitHub Pages」などで公開するのが簡単です。

## 2.1) 公開（GitHub Pages / 無料）

1. このフォルダを GitHub に push
2. GitHub の Settings → Pages → Branch を設定して公開
3. 公開URL（例: `https://<user>.github.io/<repo>/`）を開いて利用

公開URLで動かすと、QRにそのURLが入るため参加者もアクセスできます。

### `release.ps1` で公開（stable/dev を分ける）

このリポジトリには、公開用に `index.html` の `?v=`（キャッシュバスター）を更新して commit/push するスクリプト [release.ps1](release.ps1) が入っています。

- stable（通常の公開URL）へ push:
  - `./release.ps1 -Channel stable -Message "release"`
- dev（開発用の別リポジトリ/別URL）へ push:
  - 初回だけ dev リモートを追加（例）:
    - `git remote add dev https://github.com/<user>/B_BoardGames-dev.git`
  - その後:
    - `./release.ps1 -Channel dev -Message "dev"`
- 両方へ push:
  - `./release.ps1 -Channel both -Message "release"`

※ dev リモートが未設定の場合は `-DevRemoteUrl` で自動追加もできます。

## 2.2) いちばん簡単な配り方（おすすめ）

- あなたが一度だけ GitHub Pages などでこのアプリを公開
- ゲームマスターはその公開URLを開き、トップの「セットアップ（Firebase設定）」に config JSON を貼り付けて保存
- あとは「部屋を作る」→QR配布で進行

つまり **ゲームマスターがソースコードを編集する必要がありません**。

## 3) 使い方

1. PC/スマホでトップ → 「部屋を作る」
  - 初回だけ「セットアップ（Firebase設定）」を済ませる
2. 人数・少数側人数・トーク時間・逆転・ワードを入力
  - 「お題カテゴリ」→「ランダム出題」でもOK
3. QRを参加者に見せる
4. 参加者はQR→名前入力→参加
5. GMも「GMも参加」から同様に参加
6. 全員揃ったら GM が「役職配布」→「トーク開始」
7. 投票を使う場合: GM が「投票開始」→参加者が投票
8. GM が「集計して開示」
9. 最後に GM が「開示（少数側発表）」
10. 逆転ありの場合、少数側端末で「多数側ワード」を入力して確定

## 補足

- 「お題ランダム出題」「投票→集計→開示」まで実装済みです。
- 必要なら次は「勝敗の自動判定（投票で吊られた人が少数側なら多数側勝ち、逆転成功なら少数側勝ち）」などを追加できます。
