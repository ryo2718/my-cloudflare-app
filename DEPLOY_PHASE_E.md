# Phase E: 本番デプロイ手順

Phase A〜D で実装した認証システム + Strategy/Quiz + 管理画面を Cloudflare に
デプロイする手順。**Claude Code からは Cloudflare アカウントへアクセスできない
ため、ユーザー (オペレーター) の手動実行が必要**。

---

## 必要な権限

- `wrangler login` 済 Cloudflare アカウント (`my-cloudflare-app` Pages 所有者)
- R2 bucket (`pokergto-flop-data`) に書込み可

確認:
```bash
npx wrangler whoami
# → email + account_id が表示されれば OK
```

---

## E-1. Cloudflare D1 データベース作成

```bash
cd /Users/shirairyouitaru/pokerprojects/pokergtoapp
npx wrangler d1 create poker-app-db
```

出力例:
```
✅ Successfully created DB 'poker-app-db' in region <REGION>!

[[d1_databases]]
binding = "DB"
database_name = "poker-app-db"
database_id = "<UUID-COPY-THIS>"
```

→ **出力された `database_id` を `wrangler.toml` の `[[d1_databases]]` の
`database_id` に貼り付け** (現状 `00000000-0000-0000-0000-000000000000` プレースホルダ)。

---

## E-2. リモート D1 マイグレーション

```bash
npm run d1:migrate:remote
# 内部:
#   wrangler d1 execute poker-app-db --remote --file=./migrations/0001_init.sql
#   wrangler d1 execute poker-app-db --remote --file=./migrations/0002_seed.sql
```

確認:
```bash
npx wrangler d1 execute poker-app-db --remote --command "SELECT poker_name FROM accounts; SELECT key_value FROM group_keys;"
# → テスト君 / 2818 が出れば OK
```

---

## E-3. Pages にデプロイ

```bash
npm run deploy
# 内部:
#   tsc -b && vite build
#   wrangler pages deploy dist --project-name=my-cloudflare-app
```

出力:
```
✨ Deployment complete! Take a peek over at https://<commit-hash>.my-cloudflare-app-5mb.pages.dev
```

production URL: `https://my-cloudflare-app-5mb.pages.dev/` (デフォルト production branch にデプロイ)

`functions/` 配下の TypeScript は wrangler が自動 bundle してデプロイされる。

---

## E-4. 本番動作確認 (手動)

ブラウザで `https://my-cloudflare-app-5mb.pages.dev/` を開き、以下を確認:

| # | 動作 | 期待 |
|---|---|---|
| 1 | 初回アクセス | LoginGate が出る |
| 2 | ログイン: テスト君 / test / 2818 | Home (Strategy / Quiz 選択) に遷移 |
| 3 | `/strategy` に遷移 | 既存の Preflop / Flop タブ表示 |
| 4 | Flop タブ → R2 から flop データ fetch | 表示成功 (CORS OK な production origin) |
| 5 | `/quiz` に遷移 | "実装中" placeholder |
| 6 | header の「管理画面」リンク | `/admin` Dashboard 表示 |
| 7 | `/admin/accounts` | テスト君が一覧に表示 (パスワードはトグル) |
| 8 | `/admin/group-key` | 現在 "2818" が表示、新 key 発行で履歴に追加 |
| 9 | ログアウト → 再ログイン | LocalStorage の session が更新 |
| 10 | 一般ユーザーで signup → admin 画面アクセス試行 | `/admin` でホームに redirect (非 admin 保護) |

---

## E-5. R2 CORS 設定 (本番 origin を追加)

現状 R2 CORS allowlist は `http://localhost:5173` 等。**production origin
`https://my-cloudflare-app-5mb.pages.dev` も含める**:

Cloudflare ダッシュボード → R2 → `pokergto-flop-data` → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://my-cloudflare-app-5mb.pages.dev",
      "https://*.my-cloudflare-app-5mb.pages.dev"
    ],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Type"]
  }
]
```

(localhost は dev 用にそのまま残す)

---

## E-6. 環境変数 (Pages production)

Cloudflare ダッシュボード → Pages → `my-cloudflare-app` → Settings → Environment
variables → Production:

| Name | Value | 種別 |
|---|---|---|
| `VITE_FLOP_DATA_BASE_URL` | `https://pub-15ae08e085da4c138ef4f04dde1dbfeb.r2.dev/data/flop/v1/cash_100bb_6max_nl500_2.5x` | Plaintext |

旧 `SITE_PASSWORD` / `AUTH_SECRET` は Phase B で使われていない。削除して OK。

---

## E-7. ロールバック (緊急時)

### コードのロールバック
```bash
# Pages ダッシュボード → Deployments → 一個前の deployment → Rollback
```

### D1 のロールバック
D1 にはネイティブ rollback コマンドがないため、`backups/` に SQL dump を保存し
ておくのが安全:

```bash
# 事前に
npx wrangler d1 export poker-app-db --remote --output=./backups/d1-$(date +%Y%m%d-%H%M).sql
```

事故時:
```bash
# テーブルをリセット (危険)
npx wrangler d1 execute poker-app-db --remote --command "DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS quiz_results; DROP TABLE IF EXISTS group_keys; DROP TABLE IF EXISTS accounts;"
npx wrangler d1 execute poker-app-db --remote --file=./backups/d1-<TIMESTAMP>.sql
```

---

## E-8. デプロイ後のローカル開発を継続する場合

`.env.development.local` の dev-only R2 proxy 設定はそのまま動く。本番デプロイ
した結果が `.env.local` (production 用) には影響しない。

| 用途 | コマンド |
|---|---|
| Vite dev (R2 proxy 込み、port 5173) | `npm run dev` |
| Pages dev (Functions + D1、port 8788) | `npm run dev:functions` |
| 本番デプロイ | `npm run deploy` (要 wrangler login) |

---

## Claude Code が自動でやらないこと

以下は **オペレーター手動実行が必要**:

- [ ] `wrangler login` (Cloudflare アカウントログイン)
- [ ] `wrangler d1 create poker-app-db` (本番 D1 作成、database_id 取得)
- [ ] `wrangler.toml` の `database_id` 書換え (上記出力を貼り付け)
- [ ] `npm run d1:migrate:remote` (本番マイグレーション)
- [ ] R2 CORS 設定の更新 (Cloudflare ダッシュボード)
- [ ] Pages env vars 設定 (Cloudflare ダッシュボード)
- [ ] `npm run deploy` (本番デプロイ)
- [ ] production URL での動作確認

Phase A〜D の全コード変更 + ローカル動作確認は完了済み。残りはユーザー操作のみ。
