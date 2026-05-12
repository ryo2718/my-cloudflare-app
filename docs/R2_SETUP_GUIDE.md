# R2 セットアップガイド (Flop データ配信)

Phase 3 (`useFlopNode` hook) 着手前に完了させる作業手順書。`docs/FLOP_STRATEGY_TAB.md §4.1` の手順を **コピペで実行可能な形** に展開する。

**最終目標**:
```
https://<your-custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x/<variant>/<file>.json
```
で 1.6 GB / 2,686 ファイルが 200 OK で取得できる状態。

**所要時間**: 約 30-60 分 (アップロード時間に依存、回線次第)

---

## 0. 前提

- Cloudflare アカウントを所有していること (Free プランで OK、R2 は 10 GB/月まで無料)
- ローカルの flop データが `/Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x/` に存在すること
- DNS を Cloudflare で管理しているドメインがあること (custom domain 用、別ドメインでも DNS を Cloudflare に向ければ OK)

データ存在確認:
```bash
ls /Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x/ | wc -l
# → 45 (variant directory)
find /Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x/ -name "*.json" | wc -l
# → 2686
du -sh /Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x/
# → 1.6G
```

---

## 1. rclone のインストール (macOS)

`rclone` は R2 への大量ファイル転送に最適な CLI ツール (S3 互換、並列転送)。

```bash
brew install rclone
```

確認:
```bash
rclone version
# → rclone v1.xx.x (1.68.0 以上推奨)
```

`brew` が無い場合は https://brew.sh からインストール。

---

## 2. Cloudflare R2 bucket の作成

### 2-1. R2 を有効化 (初回のみ)

1. https://dash.cloudflare.com にログイン
2. 左サイドバーの **R2** をクリック
3. 初回の場合「Enable R2」ボタン → 支払い情報の登録 (無料枠内なら課金されない)

### 2-2. bucket 作成

1. R2 ダッシュボード → **「Create bucket」** ボタン
2. 設定:
   - **Name**: `pokergtoapp-flop` (任意、グローバルユニーク)
   - **Location**: `Automatic` (推奨、最寄りリージョン自動選択)
   - **Default Storage Class**: `Standard`
3. **「Create bucket」** で作成完了

---

## 3. R2 API トークン作成

rclone から R2 にアクセスするためのアクセスキー。

1. R2 ダッシュボード → 右上 **「Manage R2 API Tokens」** をクリック
   (または: My Profile → API Tokens → 「R2 Tokens」タブ)
2. **「Create API token」** をクリック
3. 設定:
   - **Token name**: `pokergtoapp-flop-rclone` (任意、管理用)
   - **Permissions**: **Object Read & Write**
   - **Specify bucket**: `pokergtoapp-flop` のみ (= 作った bucket だけに権限付与)
   - **TTL**: 任意 (永続でも OK、ローテーション運用するなら 1 年など)
4. **「Create API Token」** クリック
5. **画面に表示される 3 つの値を即コピー** (画面を離れると二度と見られない):
   - **Access Key ID**: `xxxxxxxxxxxxxxxxxx`
   - **Secret Access Key**: `yyyyyyyyyyyyyyyyyy`
   - **Endpoint**: `https://<account-id>.r2.cloudflarestorage.com`

トークンが画面遷移で失われたら 4 をやり直し (上書きでなく新規作成)。

---

## 4. rclone 設定

`rclone config` の対話モードを使う。

```bash
rclone config
```

対話プロンプト応答 (`>` は入力):

```
Current remotes:
Name                 Type
====                 ====

e) Edit existing remote
n) New remote
s) Set configuration password
q) Quit config
e/n/s/q> n

Enter name for new remote.
name> r2

Type of storage to configure.
Storage> s3

Choose your S3 provider.
provider> Cloudflare       (リストから "Cloudflare" を選ぶ。番号で指定する場合は表示された番号)

Get AWS credentials from runtime (environment variables or EC2/ECS meta data if no env vars).
env_auth> false            (= 1、Enter credentials in the next step)

AWS Access Key ID.
access_key_id> <ステップ 3 でコピーした Access Key ID>

AWS Secret Access Key (password).
secret_access_key> <ステップ 3 でコピーした Secret Access Key>

Region to connect to.
region> auto               (= 1、Cloudflare R2 では auto を選ぶ)

Endpoint for S3 API.
endpoint> https://<account-id>.r2.cloudflarestorage.com
                           (ステップ 3 でコピーした Endpoint URL)

Location constraint - must be set to match the Region.
location_constraint>       (空のまま Enter)

Canned ACL used when creating buckets and storing or copying objects.
acl>                       (空のまま Enter)

Edit advanced config?
y/n> n

Keep this "r2" remote?
y/e/d> y

Current remotes:
Name                 Type
====                 ====
r2                   s3

q) Quit config
e/n/s/q> q
```

設定確認:
```bash
rclone listremotes
# → r2:

rclone lsd r2:
# → bucket 一覧が表示される (作成した pokergtoapp-flop が含まれていれば OK)
```

エラーになる場合:
- `connection refused`: endpoint URL が間違っている (account-id 部分)
- `403 InvalidAccessKeyId`: Access Key ID / Secret が間違っている (ステップ 3 やり直し)
- `404`: bucket 名が違う (ステップ 2 の名前を再確認)

---

## 5. アップロード実行

### 5-1. 単一ファイルで疎通テスト (推奨、最初に必ず実施)

いきなり 1.6 GB を投げる前に 1 ファイル試す:

```bash
rclone copy \
  /Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x/utgr_bbc/flop_root.json \
  r2:pokergtoapp-flop/data/flop/v1/cash_100bb_6max_nl500_2.5x/utgr_bbc/ \
  --progress
```

R2 ダッシュボード → bucket → Objects で `data/flop/v1/cash_100bb_6max_nl500_2.5x/utgr_bbc/flop_root.json` が見えれば OK。

### 5-2. 全データアップロード

```bash
rclone copy \
  /Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x \
  r2:pokergtoapp-flop/data/flop/v1/cash_100bb_6max_nl500_2.5x \
  --transfers=20 \
  --progress
```

オプション:
- `--transfers=20`: 並列転送 (20 ファイル同時、回線太ければ 30 等)
- `--progress`: 進捗バー表示
- `--dry-run` を追加すると実際にアップロードせず転送計画だけ表示 (試運転用)

完了確認:
```bash
rclone size r2:pokergtoapp-flop/data/flop/v1/cash_100bb_6max_nl500_2.5x
# → "Total objects: 2686, Total size: 1.6 GiB" 程度を確認
```

中断した場合は同じコマンドを再実行 → 差分のみアップロードされる (rclone は差分転送)。

---

## 6. Custom domain 割り当て

### 6-1. 設定画面へ

1. R2 ダッシュボード → `pokergtoapp-flop` bucket をクリック
2. 上部タブ → **Settings**
3. セクション **Custom Domains** → **「Connect Domain」**

### 6-2. ドメイン入力

例えば `flop-data.example.com` を使う場合:

1. Input field に `flop-data.example.com` を入力
2. **「Continue」** クリック
3. DNS レコードが自動で Cloudflare に追加される (R2 と同じ Cloudflare アカウントなら)
4. ステータスが **Active** になれば疎通可能 (5-10 分待つ)

別アカウントで管理しているドメインの場合:
- Cloudflare が CNAME レコードを生成する → ドメイン側 DNS に CNAME を手動追加

### 6-3. R2.dev URL を使う場合 (custom domain 不要、テスト用)

custom domain 設定をスキップして `https://pub-<random>.r2.dev/...` を使うことも可能 (テスト/開発用)。本番では custom domain 推奨 (cache 効率・移行耐性のため)。

R2.dev URL を有効化: bucket → Settings → Public access → R2.dev subdomain を Allow Access。

---

## 7. CORS 設定

ブラウザの fetch (アプリ) が R2 にアクセスできるよう許可。

### 7-1. CORS Policy を設定

1. R2 ダッシュボード → `pokergtoapp-flop` → **Settings** → **CORS Policy** セクション
2. **「Edit CORS policy」** クリック
3. 以下 JSON を貼り付け:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:4173",
      "https://<your-pages-domain>"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Type"],
    "MaxAgeSeconds": 86400
  }
]
```

差し替え:
- `<your-pages-domain>`: 本番デプロイ先 (例: `https://pokergtoapp.pages.dev` または独自ドメイン)
- localhost は開発用 (`5173` = vite dev、`4173` = vite preview)

4. **「Save」**

---

## 8. 動作確認

### 8-1. curl で直接 fetch

```bash
curl -I "https://<your-custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x/utgr_bbc/flop_root.json"
```

期待される応答:
```
HTTP/2 200
content-type: application/json
content-length: <数値>
etag: "<hash>"
cf-cache-status: DYNAMIC | HIT | MISS
```

確認ポイント:
- ✓ `HTTP/2 200` (404 や 403 でない)
- ✓ `content-type: application/json`
- ✓ `cf-cache-status:` のヘッダがある (Cloudflare CDN 経由)

### 8-2. CORS preflight 確認

```bash
curl -I -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  "https://<your-custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x/utgr_bbc/flop_root.json"
```

期待される応答:
```
HTTP/2 200
access-control-allow-origin: http://localhost:5173
access-control-allow-methods: GET, HEAD
```

`access-control-allow-origin` が返ってこない場合はステップ 7 の CORS 設定見直し。

### 8-3. 中身を 1 件取得して JSON parse 確認

```bash
curl "https://<your-custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x/utgr_bbc/flop_root.json" \
  | head -c 200
```

`{"status": "done", ...` で始まれば OK。

---

## 9. アプリ側環境変数の設定

### 9-1. ローカル開発用

プロジェクトルート (`/Users/shirairyouitaru/pokerprojects/pokergtoapp/`) に `.env.local` を作成:

```bash
# .env.local (gitignore 済、commit しない)
VITE_FLOP_DATA_BASE_URL=https://<your-custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x
```

`.env.local` は `.gitignore` の `*.local` で除外済 → 誤コミットの心配なし。

### 9-2. 本番 (Cloudflare Pages)

1. Cloudflare ダッシュボード → **Workers & Pages** → 該当 Pages プロジェクト
2. **Settings** → **Environment variables** タブ
3. **Production** タブで **「Add variable」**:
   - Name: `VITE_FLOP_DATA_BASE_URL`
   - Value: `https://<your-custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x`
4. **Preview** タブにも同様に追加 (PR preview 環境用)
5. 次回デプロイから反映

### 9-3. 設定確認

```bash
cd /Users/shirairyouitaru/pokerprojects/pokergtoapp
cat .env.local
```
正しい URL が表示されることを確認。

---

## 10. Phase 3 着手チェックリスト

すべて ✓ なら Phase 3 着手可能:

- [ ] R2 bucket 作成済み
- [ ] 2,686 ファイル / 1.6 GB アップロード完了 (`rclone size` で確認)
- [ ] Custom domain ステータス Active
- [ ] CORS policy 設定済 (localhost + production origin)
- [ ] `curl -I` で 200 OK 確認
- [ ] CORS preflight が `access-control-allow-origin` を返す
- [ ] `.env.local` に `VITE_FLOP_DATA_BASE_URL` 記述
- [ ] (本番) Cloudflare Pages の環境変数も登録

---

## 11. トラブルシューティング

### 11-1. アップロード時のエラー

| エラー | 原因 | 対処 |
|---|---|---|
| `403 SignatureDoesNotMatch` | Secret Access Key の typo | ステップ 3 で再発行 |
| `403 InvalidAccessKeyId` | Access Key ID の typo | 同上 |
| `connection refused` | endpoint URL の typo (`<account-id>` 部分) | ステップ 3 で再確認 |
| `bucket not found` | bucket 名 typo or 違うアカウント | `rclone lsd r2:` で確認 |
| 速度が遅い | `--transfers` が小さい / 回線飽和 | `--transfers=30` 程度に増やす |

### 11-2. 配信時のエラー

| 現象 | 原因 | 対処 |
|---|---|---|
| `curl` で 404 | パス間違い、または未アップロード | `rclone ls r2:<bucket>/<path>` で実在確認 |
| `curl` で 403 (public_access disabled) | bucket が public 未設定 | custom domain を割り当てるか、Public access の R2.dev subdomain を Allow |
| `curl` で CF-Cache-Status: BYPASS | custom domain がまだ Active でない | 5-10 分待つ |
| ブラウザの fetch で CORS error | Origin が CORS policy に未登録 | ステップ 7 を修正、保存後 30 秒程度反映待ち |

### 11-3. アップロードを途中で止めた場合

`rclone copy` は idempotent (既に同サイズの同名オブジェクトがあれば skip)。再実行で続きから:

```bash
rclone copy \
  /Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x \
  r2:pokergtoapp-flop/data/flop/v1/cash_100bb_6max_nl500_2.5x \
  --transfers=20 --progress
```

差分のみ転送される。

### 11-4. バケットを作り直したい場合

```bash
# 全削除 (慎重に!)
rclone purge r2:pokergtoapp-flop/data/flop/v1/cash_100bb_6max_nl500_2.5x
# または bucket ごと削除
rclone purge r2:pokergtoapp-flop
```

---

## 12. 完了後の状態

```
R2:
  pokergtoapp-flop/
   └── data/flop/v1/cash_100bb_6max_nl500_2.5x/
       ├── btnr_bbc/
       │   ├── flop_root.json
       │   └── ...(89 files)
       ├── btnr_bbr_btnr27_bbc/
       └── ...(45 variant dirs total)

Public URL: https://<your-custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x/<variant>/<file>.json
CORS: allow http://localhost:5173 + production origin

Local app:
  .env.local: VITE_FLOP_DATA_BASE_URL=https://<your-custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x
```

完了したら Claude Code に「R2 セットアップ完了」と報告 → Phase 3 着手します。
