# Phase A + B 設計レポート: 認証システム導入

作成日: 2026-05-17
対象: `pokergtoapp` (Cloudflare Pages + R2 上で動く SPA 教材アプリ)

---

## Phase A: 現状調査

### A-1. プロジェクト状況サマリ

| 項目 | 値 |
|---|---|
| アプリ名 | `pokergtoapp` (内部) / `my-cloudflare-app` (Cloudflare Pages) |
| **本番ドメイン** | **`my-cloudflare-app-5mb.pages.dev`** ※ DEPLOY.md に明記 |
| **R2 バケット** | **`pokergto-flop-data`** (Flop データ 1.6 GB) |
| R2 public URL | `https://pub-15ae08e085da4c138ef4f04dde1dbfeb.r2.dev/data/flop/v1/cash_100bb_6max_nl500_2.5x` |
| フロント | Vite 8 + React 19 + TypeScript 6 + vitest 4 |
| 既存サーバサイド | Cloudflare **Pages Functions** (`functions/` 配下、ES2022 + workers-types) |
| 既存テスト | 404 件 PASS |
| `@cloudflare/workers-types` | ^4.20260502.1 (インストール済) |
| wrangler | **未インストール** (Phase B で導入) |
| D1 | 未設定 (Phase B で導入) |

### A-2. 既存認証コード ★ 重要 ★

`functions/` 配下に **site-wide 単一パスワード認証** が既に実装済み:

```
functions/
  _middleware.ts          # 全リクエストをゲート (PUBLIC_PATHS 以外は cookie 検証)
  api/login.ts            # POST: SITE_PASSWORD と比較 → HMAC 署名 cookie 発行
  api/logout.ts           # POST: cookie を Max-Age=0 で失効
  lib/auth.ts             # HMAC-SHA256 cookie 署名/検証ユーティリティ
  tsconfig.json
```

**特徴**:
- 1 つの環境変数 `SITE_PASSWORD` に全員が同じパスワードでログイン
- セッション: HMAC 署名つき HttpOnly + Secure + SameSite=Lax cookie、30日有効
- middleware が HTML 要求を `/login.html` にリダイレクト、非 HTML を 401 で拒否

**Phase A+B での扱い**: **置き換える**。
- 仕様変更点:
  - 全員共通パスワード → **per-user account (poker_name + private_pass)**
  - 単純パスワード → **+ group_key (月次更新)**
  - HttpOnly cookie → **LocalStorage の session_id (Bearer token)**
  - Admin role 追加
- 既存ファイルは Phase B で内部実装ごと書き換え (ファイル名は再利用したり整理したり、後述)。

### A-3. ドメイン特定の所見

✅ **特定済**: `my-cloudflare-app-5mb.pages.dev` (DEPLOY.md L24, L119)
- Cloudflare Pages のプロジェクト名: `my-cloudflare-app`
- 末尾 `-5mb` は Cloudflare の preview hash 系 (固定でなく project ごとに付与)

**サブドメイン構成案**: Pages の標準 URL に admin 用サブドメインを直接付けるのは非対応。選択肢:
- **(a) パス分割**: `my-cloudflare-app-5mb.pages.dev/admin/...` (Pages 内で /admin/* ルート、推奨)
- **(b) 別 Pages プロジェクト**: `my-cloudflare-app-admin.pages.dev` を新規作成
- **(c) Custom domain**: `app.example.com` + `admin.example.com` (要 DNS 設定、別途取得が必要)

**今回 Phase A+B では (a) を採用**: 同一プロジェクト内で `/admin/*` を admin 専用ルートにする。Phase D (運営画面) でルート増設、Phase E 以降で必要なら (c) へ移行。

> 🔴 **ユーザー判断要**: カスタムドメインの取得・移行は別途検討。今回スコープ外。

### A-4. 既存コンポーネント構造 (関連箇所)

```
src/
  App.tsx                          ← トップレベル (TopTabs + 各 View をマウント)
  main.tsx                         ← entry (React mount、DEV-only ルート分岐)
  components/                      ← 32 ファイル
    TopTabs.tsx, FlopStrategyView.tsx, DualRangeView.tsx, ...
  hooks/                           ← データ fetch hooks
  data/, types/, utils/, styles/
  integration.test.ts
  pages/__dev__/FlopReportCellDemo.tsx
```

**Phase B の追加位置**:
- `src/contexts/AuthContext.tsx` (新規)
- `src/components/LoginGate.tsx` (新規、未認証時に App をラップして覆う)
- `src/components/SignupForm.tsx` (新規)
- `src/api/auth.ts` (新規、`/api/auth/*` を叩く client)
- `src/hooks/useAuth.ts` (新規、context 薄ラッパー)
- `App.tsx` を最小変更 (`<AuthProvider>` で wrap、`<LoginGate>` で gate)

---

## Phase B: 認証システム設計

### B-1. データベース設計 (Cloudflare D1)

D1 = Cloudflare の SQLite。`wrangler d1` で操作。

#### スキーマ (`migrations/0001_init.sql`)

```sql
-- ----------------------------------------------------------------------------
-- accounts: ユーザーアカウント
--   - poker_name: 表示名兼ログイン ID (unique)
--   - private_pass: 平文保存 (身内向け要件、運営閲覧用)
--   - is_admin: 0/1 (admin 画面アクセス可否)
-- ----------------------------------------------------------------------------
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poker_name TEXT UNIQUE NOT NULL,
  private_pass TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  created_at INTEGER NOT NULL,                -- unix ms
  last_login_at INTEGER                       -- unix ms or NULL
);
CREATE INDEX idx_accounts_poker_name ON accounts(poker_name);

-- ----------------------------------------------------------------------------
-- group_keys: グループ参加キー (月次更新)
--   - 同時に有効なキーは原則 1 つ (active_until IS NULL)
--   - 更新時は旧レコードに active_until をセット、新レコード INSERT
-- ----------------------------------------------------------------------------
CREATE TABLE group_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_value TEXT NOT NULL,
  active_from INTEGER NOT NULL,
  active_until INTEGER,                       -- NULL = 現在有効
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_group_keys_active ON group_keys(active_until);

-- ----------------------------------------------------------------------------
-- sessions: ログインセッション (LocalStorage に session_id を保存)
--   - id: UUID v4 (Bearer token として利用)
--   - expires_at 経過後は GC 対象 (mass delete は手動 or Phase D 以降の cron)
-- ----------------------------------------------------------------------------
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_account ON sessions(account_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ----------------------------------------------------------------------------
-- quiz_results: Quiz 成績 (Phase E で詳細決定、現状は account_id だけの空テーブル)
-- ----------------------------------------------------------------------------
CREATE TABLE quiz_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX idx_quiz_results_account ON quiz_results(account_id);
```

#### 初期データ (`migrations/0002_seed.sql`)

```sql
-- テスト君 (admin)
INSERT INTO accounts (poker_name, private_pass, is_admin, created_at)
VALUES ('テスト君', 'test', 1, strftime('%s', 'now') * 1000);

-- 現行 group_key
INSERT INTO group_keys (key_value, active_from, active_until, created_at)
VALUES ('<INITIAL_GROUP_KEY>', strftime('%s', 'now') * 1000, NULL, strftime('%s', 'now') * 1000);
-- 注: 実 seed の Group Key 値は migrations/0002_seed.sql に記載 (リポジトリで読まれる可能性あり、運営が個別管理)
```

---

### B-2. API 設計 (Pages Functions)

> **判断**: ユーザー指示は「Workers」だが、本アプリは既に Cloudflare **Pages Functions** で稼働中。
> Pages Functions は Workers と同ランタイムで、Pages プロジェクトに紐付けて同一オリジンで動く。
> SPA + 別オリジン Workers 構成より同一オリジン Pages Functions の方が:
>  - CORS 不要
>  - cookie/トークンの取り回しが楽
>  - deploy が一本化
>
> よって **Pages Functions のまま継続**。ユーザー仕様の LocalStorage tokens 要件は Bearer 認証で満たす。

#### ファイル配置

```
functions/
  _middleware.ts                ← /api/admin/* のみ admin 認証チェックに簡略化 (HTML protect 削除)
  api/
    auth/
      login.ts                  ← POST: { poker_name, private_pass, group_key }
      signup.ts                 ← POST: { poker_name, private_pass, group_key }
      me.ts                     ← GET: Bearer 検証して account 返す
      logout.ts                 ← POST: session 削除
    admin/
      accounts.ts               ← GET: 全 accounts 一覧 (平文パス含む、admin only)
      group_key.ts              ← POST: 新 key 設定、旧 key の active_until を埋める
  lib/
    db.ts                       ← D1 helper (typed queries)
    auth.ts                     ← session 検証 helper (旧 HMAC は撤去 or rename)
    types.ts                    ← Account / Session / GroupKey 型
```

#### エンドポイント詳細

##### `POST /api/auth/signup`
```jsonc
// Request
{
  "poker_name": "ryo",
  "private_pass": "hunter2",
  "group_key": "<provided by ops>"
}
// Response 200
{
  "session_id": "<uuid>",
  "account": { "id": 1, "poker_name": "ryo", "is_admin": false }
}
// Response 400 (group_key 不一致、name 重複、形式不正)
{ "error": "invalid_group_key" | "name_taken" | "invalid_payload" }
```

##### `POST /api/auth/login`
```jsonc
// Request
{
  "poker_name": "ryo",
  "private_pass": "hunter2",
  "group_key": "<provided by ops>"      // ログイン時も毎回 group_key を要求 (退会者の継続利用を防止)
}
// Response 200
{ "session_id": "<uuid>", "account": { "id": 1, "poker_name": "ryo", "is_admin": false } }
// Response 401
{ "error": "invalid_credentials" | "invalid_group_key" }
```

##### `GET /api/auth/me`
```
Header: Authorization: Bearer <session_id>
// Response 200
{ "account": { "id": 1, "poker_name": "ryo", "is_admin": false } }
// Response 401
{ "error": "unauthorized" }
```

##### `POST /api/auth/logout`
```
Header: Authorization: Bearer <session_id>
// Response 200
{ "ok": true }
```

##### `GET /api/admin/accounts` (admin only)
```jsonc
// Response 200
{
  "accounts": [
    {
      "id": 1, "poker_name": "テスト君",
      "private_pass": "test",                   // 平文 (運営閲覧用、身内要件)
      "is_admin": true,
      "created_at": 1747353600000,
      "last_login_at": 1747400000000
    }
  ]
}
// Response 403 (admin 以外)
{ "error": "forbidden" }
```

##### `POST /api/admin/group_key` (admin only)
```jsonc
// Request
{ "new_key": "4915" }
// Response 200
{ "active_from": 1747400000000, "key_value": "4915" }
// Response 400 (空文字等)
{ "error": "invalid_payload" }
```

#### 認証フロー

```
LocalStorage に session_id があれば → /api/auth/me で検証
  ↓ 200            ↓ 401
  認証済           未認証 (LocalStorage クリア)
  ↓                 ↓
  本アプリ表示    <LoginGate> 表示
```

---

### B-3. 画面構造設計 (Phase B 範囲は LoginGate のみ)

Phase B では LoginGate と認証 wiring まで。Strategy/Quiz 二大ボタン (Phase C) と admin 画面 (Phase D) は別フェーズ。

```
[未認証]
  <App> マウント時 LocalStorage 確認 → /api/auth/me 失敗
  → <LoginGate>           Login / Signup タブ切替
                          - Login: poker_name + private_pass + group_key
                          - Signup: poker_name + private_pass + group_key

[認証済み (Phase B 段階)]
  <App> 現状の UI (TopTabs: Preflop / Flop) をそのまま表示
  右上に Logout ボタン (是別の通常 header に追加)

[Phase C 以降]
  ├── / → 二大ボタン (Strategy / Quiz)
  ├── /strategy → 現 App.tsx (Preflop + Flop)
  └── /quiz → 仮実装
```

---

### B-4. セキュリティ設計

| 観点 | 採用 | 備考 |
|---|---|---|
| パスワード保存 | **平文 (BCRYPT なし)** | 身内向け & 運営が閲覧する要件 |
| group_key 検証 | `active_until IS NULL` のレコードと比較 | 月次更新時は admin が旧 key の active_until を埋める |
| session ID | UUID v4 (crypto.randomUUID()) | 16 bytes × hex 36 chars 衝突確率実質 0 |
| session 有効期限 | 30 日 (`SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000`) | LocalStorage に session_id のみ保存 (パスワード保存しない) |
| token 送信 | `Authorization: Bearer <id>` | HttpOnly cookie 廃止 (LocalStorage 要件) |
| token 失効 | logout で D1 sessions 行を DELETE、自然失効は expires_at | 期限切れ session の GC は手動 (Phase E で cron 化検討) |
| admin 判定 | `account.is_admin === 1` | middleware が `/api/admin/*` で要 admin チェック |
| CORS | 不要 (Pages Functions = 同一オリジン) | LAN/dev 環境では Vite proxy で吸収 (既存) |
| timing attack | constant-time 比較 (poker_name lookup 後の pass 比較) | 既存 lib/auth.ts に `constantTimeEq` ある、流用 |

---

### B-5. 環境構築コマンド (Phase B 実行手順)

```bash
# 1. wrangler 導入 (devDep)
npm install -D wrangler

# 2. ローカル D1 初期化 (Cloudflare 認証不要、SQLite ファイル生成のみ)
npx wrangler d1 execute poker-app-db --local --file=./migrations/0001_init.sql
npx wrangler d1 execute poker-app-db --local --file=./migrations/0002_seed.sql

# 3. ローカル Pages 起動 (functions + 静的アセット)
npx wrangler pages dev . --port 8788 --d1 DB=poker-app-db

# (4. クラウド D1 作成 — Phase A+B では実行しない、ユーザー指示後に)
# npx wrangler d1 create poker-app-db
# → wrangler.toml に database_id を貼り付け
# npx wrangler d1 execute poker-app-db --remote --file=./migrations/0001_init.sql
# npx wrangler d1 execute poker-app-db --remote --file=./migrations/0002_seed.sql
```

#### `wrangler.toml` (新規作成)

```toml
name = "my-cloudflare-app"
compatibility_date = "2026-05-17"
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "poker-app-db"
database_id = "PLACEHOLDER_FILL_ON_CLOUD_CREATE"  # ローカル開発では未使用、cloud で取得後に埋める
```

---

### B-6. ドメイン設定の所見

| 項目 | 現状 / 推奨 |
|---|---|
| 本番 URL | `https://my-cloudflare-app-5mb.pages.dev/` (Pages 標準) |
| admin URL | **同一 Pages の `/admin/*` パス** (Phase D で実装) |
| カスタムドメイン | 未取得・未設定。必要なら別途検討 (`app.example.com` / `admin.example.com` 等) |
| DNS 設定 | カスタムドメインを使う場合のみ。Cloudflare DNS → CNAME → Pages |
| 別オリジン Workers | **採用しない** (Pages Functions で十分、CORS 不要) |

---

## Phase A まとめ + Phase B 着手前の判断ポイント

✅ ドメイン特定: `my-cloudflare-app-5mb.pages.dev`
✅ 既存認証は site-wide 単一パスワード (置き換え対象、Phase B で除去)
✅ Pages Functions 採用 (新規 Workers は作らない)
⚠️ admin サブドメインは Phase D で同一 Pages の `/admin/*` パス採用
⚠️ クラウド D1 作成は Phase A+B では行わず、ローカル D1 のみで動作確認 → 後で `wrangler d1 create` 実行 (要 Cloudflare ログイン)
⚠️ 既存 `functions/_middleware.ts` の site-wide gate は **本フェーズで撤去**。SPA 側の LoginGate に役割移行

## Phase B 完了条件

1. ✅ `design_phase_ab.md` (本ファイル)
2. ✅ `migrations/0001_init.sql` + `0002_seed.sql`
3. ✅ ローカル D1 にスキーマ + 初期データ投入
4. ✅ `functions/api/auth/*.ts` 4 endpoints + `functions/api/admin/*.ts` 2 endpoints
5. ✅ `src/contexts/AuthContext.tsx` + `LoginGate.tsx` + `SignupForm.tsx`
6. ✅ テスト君 (poker_name=テスト君, private_pass=test, group_key=運営から提供) でログイン可
7. ✅ Signup 経路で group_key 不一致 → 拒否、一致 → アカウント作成
8. ✅ 既存 404 テスト PASS、型/lint/build clean
