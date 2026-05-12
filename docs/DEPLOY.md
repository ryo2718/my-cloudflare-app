# デプロイ手順 (Cloudflare Pages + R2)

本アプリは **完全クライアント完結 SPA** で、Cloudflare Pages 上に静的ホスト + Cloudflare R2 から
Flop データを配信する構成。本ドキュメントは初回 + 日常デプロイ手順をまとめる。

> 詳細な R2 セットアップは `docs/R2_SETUP_GUIDE.md` を参照 (rclone、API トークン、CORS 等)。
> 本ドキュメントは Pages 側の deploy フロー中心。

## 0. 構成概要

```
┌────────────────────────────────────────────────────────┐
│ Cloudflare Pages (my-cloudflare-app)                   │
│  - SPA: HTML + JS (gzip ~87 KB)                        │
│  - 同梱データ: Preflop 128 JSON (~1.2 MB)              │
│  - 環境変数: VITE_FLOP_DATA_BASE_URL                   │
└─────────────┬──────────────────────────────────────────┘
              │ runtime fetch
              ▼
┌────────────────────────────────────────────────────────┐
│ Cloudflare R2 (pokergto-flop-data)                     │
│  - 2,686 ファイル / 1.6 GB                             │
│  - public access (R2.dev URL)                          │
│  - CORS: localhost + pages.dev allowlist               │
└────────────────────────────────────────────────────────┘
```

## 1. 初回セットアップ (1 回だけ)

### 1-1. R2 セットアップ
`docs/R2_SETUP_GUIDE.md` に従って以下を完了:
- [ ] R2 bucket `pokergto-flop-data` 作成
- [ ] API トークン (Object Read & Write、bucket scope)
- [ ] `rclone copy` で 1.6 GB upload (~5-10 分)
- [ ] Public access 有効化 → R2.dev URL 取得
- [ ] CORS policy 設定 (localhost + production origin)
- [ ] `curl -I` で 200 OK 確認

### 1-2. Cloudflare Pages プロジェクト作成
1. Cloudflare ダッシュボード → **Workers & Pages** → **Create application** → **Pages**
2. **Connect to Git** で GitHub repo を選択
3. Build settings:
   - **Framework preset**: Vite (auto-detect)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: (空、リポジトリルート)
   - **Node version**: `20` (Environment variables に `NODE_VERSION=20` でも可)

### 1-3. 環境変数登録 (Pages Settings → Variables and Secrets)

**Production** タブ:
| Variable | Value |
|---|---|
| `VITE_FLOP_DATA_BASE_URL` | `https://pub-<your-hash>.r2.dev/data/flop/v1/cash_100bb_6max_nl500_2.5x` |

**Preview** タブ: 同上 (PR preview 環境でも Flop が動くため)

> ⚠️ 環境変数は **deploy 単位で固定** されるため、追加後は次回 deploy から反映。
> 既存 deployment には反映されない (Retry deployment が必要)。

### 1-4. ローカル開発用 `.env.local`
プロジェクトルートに `.env.local` (gitignore 済):
```
VITE_FLOP_DATA_BASE_URL=https://pub-<your-hash>.r2.dev/data/flop/v1/cash_100bb_6max_nl500_2.5x
```

## 2. 日常デプロイ (コード変更時)

`main` ブランチへ push すると Pages が自動で deploy する。

```bash
# 1. ローカルで最終確認
npm test              # 174 tests pass
npm run build         # tsc + vite build
npm run lint          # 0 errors

# 2. commit + push
git status
git add <files>
git commit -m "..."
git push origin main

# 3. Cloudflare Pages の Deployments タブで進捗確認
# - ビルド: ~1-2 分
# - 反映: ~30 秒
```

### Preview deploy (PR ベース)
PR 作成 → Cloudflare Pages が `<branch-name>.<project>.pages.dev` に自動 deploy。
Production 環境変数とは別の Preview 環境変数が使われる。

## 3. R2 データ更新 (Flop 再スクレイプ時)

1. 新データを `data/cash_<config>/` に配置 (gitignore 済)
2. `node scripts/generate-flop-manifest.cjs` で `flopVariantsManifest.ts` 再生成
3. `rclone copy` で R2 へ upload (差分のみ転送される)
4. **URL versioning**: 互換性を破る場合は `/data/flop/v1/` → `/data/flop/v2/` で新 prefix
   - 新 prefix へ upload
   - 動作確認後、`VITE_FLOP_DATA_BASE_URL` を `/v2/` に切替 (Pages env vars + `.env.local`)
   - 旧 prefix を削除 (rollback したい間は残置)
5. `npm run build` でテスト + commit + push

## 4. ロールバック

### Pages 側
1. Cloudflare ダッシュボード → 該当 Pages → **Deployments**
2. 戻したい deployment の **「Rollback to this deployment」**
3. 即時反映

### R2 側 (データ問題時)
1. R2 bucket の旧 version (`/v1/`) を維持していれば `VITE_FLOP_DATA_BASE_URL` を旧 prefix に戻す
2. Pages env vars 更新 → 「Retry deployment」で反映

## 5. 監視

### 簡易稼働確認 (cron 等で 1 時間おき推奨)
```bash
# Pages SPA
curl -I https://my-cloudflare-app-5mb.pages.dev/    # → HTTP 200

# R2 配信
curl -I "$VITE_FLOP_DATA_BASE_URL/utgr_bbc/flop_root.json"    # → HTTP 200
```

### Cloudflare Analytics
- Pages: ページビュー / 帯域
- R2: リクエスト数 / Class A 操作 (`PUT`/`COPY`) / Class B 操作 (`GET`) / 転送量

### 無料枠の目安 (2026 時点)
- R2 Storage: 10 GB / 月 まで無料 (本アプリ 1.6 GB なので余裕)
- R2 Class B (GET) operations: 1,000 万 / 月 まで無料
- R2 egress: 無料 (revolutionary!)
- Pages: 500 builds / 月、無制限 bandwidth

## 6. セキュリティ

- `.env.local` は gitignore 済 (誤コミット防止)
- R2 API token は最小権限 (Object R/W only、bucket scope)
- Pages 環境変数は暗号化保存
- CORS policy で許可 origin を絞る
- 必要なら Cloudflare Zero Trust (Access) でメール OTP / IP 制限

## 7. ローカルからの直接 deploy (Wrangler 経由、任意)

Git push 経由が標準だが、Wrangler CLI で直接 deploy も可能:

```bash
npm install -g wrangler
wrangler login
npm run build
wrangler pages deploy dist --project-name=my-cloudflare-app
```

> 普段は git push を推奨 (Pages の Preview deploy / rollback などの機能を活かすため)。
