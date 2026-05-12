# Poker GTO Strategy Viewer (Preflop + Flop)

ポーカー (NLHE 6max, 100bb キャッシュ) の GTO 戦略を、169 ハンドマトリクスとフロップツリーの
両方で確認するための React + Vite 製のクライアント完結型 Web アプリ。

## できること

### Preflop タブ
- **DualRangeView** — Opener と Responder のレンジを 13×13 マトリクスで左右並列表示
  - Raise / All-in ボタンで深いノード (3bet, 4bet, 5bet, AI) に潜行
  - Breadcrumb (`Home › UTG open (2.5bb) › BB 3bet (12bb) › ...`) で履歴と巻き戻し
  - **「Flop に進む」ボタン** — preflop 終端から Flop タブへ シームレス遷移
- **Hand Evaluator** (画面下部、details で展開)
  - `HandInput`: combo (`AhKs`) と 169 表記 (`AKs`) どちらでも入力可、スクリーン+物理キーボード両対応
  - `OpenStrategyTable`: 5ポジション (UTG/HJ/CO/BTN/SB) の Open 戦略を ◎○🔼❌ で評価
  - `EvRankDisplay`: SB オープン EV 基準のティア (プレミアム / エリート / ... / トラッシュ) と上位%
  - `ThreebetStrategyTable`: vs ポジション別タブで 3bet/call (play率) を評価
  - `FourbetStrategyTable`: vs ポジション別タブで 4bet/call/all-in を評価

### Flop タブ (Phase 0-8 で実装、2026-05-12 完了)
- **FlopStrategyView** — 45 variants × 2,686 ノード の GTO ツリーを横断
  - Variant Selector: opener × responder × pot 深度 (limp / SRP / 3bp / 4bp / 5bp) + SB-only Open/Limp トグル
  - Board Summary: OOP / IP の EV / EQ / EQR + 大きめフロップカード表示、Visual ⇄ Numeric 切替
  - Action Totals Card: アクション集計を背景グラデ + ◎○△✕ 記号で可視化
  - Next Action Buttons: 各アクション 1 行表示 (記号 + ラベル + % + 実行ボタン)、0% は完全非表示
  - **フロップを指定** — 13×4 カードグリッドで任意のフロップ入力 → スート抽象化で正準ボード検索
  - Board 別解 (1,755 entries): 折りたたみリスト、各ボードの主要アクション 2 件表示、クリック連動
  - Breadcrumb: chain 履歴 + リセット、各 step は `BB Bet 1.8bb` 形式
- **Mobile 対応** — viewportMode 切替で MobileFlopView (Range / Eval / Flop の 3 タブ)、PC とデータ共有

## 技術スタック

- TypeScript + React 19 + Vite 8
- スタイリング: インライン style + 中央集約 `src/styles/theme.ts` (ベージュ&クリームテーマ)
- データ: 静的 JSON、`fetch()` で取得 + モジュールスコープ in-memory cache
  - Preflop: `public/data/preflop/` に同梱 (128 ファイル / ~1.2 MB)
  - Flop: Cloudflare R2 から配信 (2,686 ファイル / 1.6 GB、`VITE_FLOP_DATA_BASE_URL` 経由)
- ビルド時に静的同梱: 169ハンド × ティア lookup, 128 preflop ノードの reach メタ,
  45 flop variants manifest (`src/data/flopVariantsManifest.ts`)
- ルーティング: なし (シングルページ、PC タブ + Mobile タブで切替)
- バックエンド: なし (完全静的)

## 開発

```bash
npm install
cp /path/to/.env.example .env.local    # VITE_FLOP_DATA_BASE_URL を設定 (R2 setup 後)
npm run dev                            # http://localhost:5173/
npm run build                          # tsc -b && vite build → dist/
npm run preview                        # http://localhost:4173/ で dist/ をプレビュー
npm test                               # vitest (174 tests)
npm run lint                           # eslint (0 errors)
```

### データ生成スクリプト (再生成時のみ)

```bash
# EVランクを ev_data.json から再生成
node scripts/build-ev-tiers.cjs

# 全ノードの action_history メタを再抽出 (Breadcrumb ラベル用)
node scripts/generate-node-meta.cjs

# Flop variants manifest を data/cash_*/ から再生成
node scripts/generate-flop-manifest.cjs
```

## データ仕様

### Preflop
- ソルバー: GTO Wizard (Cash 100bb 6max NL500 General 2.5x preset)
- 配置: `public/data/preflop/cash_100bb_6max_nl500_2.5x/<node_path>.json` (128ファイル)
- スキーマ: `docs/SCHEMA.md` (v1.2.0、sparse 形式)

### Flop
- 同上 preset、`flop_tree` モード
- ローカル: `data/cash_100bb_6max_nl500_2.5x/<variant>/flop_*.json` (45 variants / 2,686 ファイル, gitignore 済)
- 配信: Cloudflare R2 public bucket、`/data/flop/v1/cash_100bb_6max_nl500_2.5x/...` 構造
- スキーマ: `src/types/flop.ts` (FlopNode = `_meta` + `action_totals` + `solutions[1755]` + `game_point` ほか)
- ボード抽象化: スート同型 1,755 代表 ⇔ 22,100 実フロップ (`src/utils/flopBoardCanonical.ts`)

## デプロイ

詳細は `docs/DEPLOY.md` 参照。要点:

### Cloudflare Pages
- ビルドコマンド: `npm run build`
- 出力ディレクトリ: `dist`
- Node バージョン: 20+ (推奨)
- 環境変数 (Production + Preview): `VITE_FLOP_DATA_BASE_URL=https://pub-xxxxxxxx.r2.dev/data/flop/v1/cash_100bb_6max_nl500_2.5x`

`public/_headers` で:
- セキュリティヘッダ (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- 静的データ (`/data/preflop/*`, `/data/ev_ranking/*`) に Cache-Control 24h
- ビルド成果物 (`/assets/*`) に Cache-Control 1年 (immutable)

`public/_redirects` は SPA 単一ページなので明示設定なし。

### R2 セットアップ
Flop データの初回 R2 アップロードは `docs/R2_SETUP_GUIDE.md` 手順に従う:
1. bucket 作成 + API トークン
2. `rclone copy` で 1.6 GB アップロード
3. R2.dev public URL を取得 (or custom domain)
4. CORS policy 設定
5. `.env.local` + Cloudflare Pages 環境変数に URL を設定

### アクセス制限 (任意)
Cloudflare Zero Trust (Access) を Pages サイトに被せると、メール OTP 等で
許可ユーザーのみ閲覧可能にできる。プライベート利用前提なら推奨。

## ライセンス・法的観点

- 本リポジトリには**ソルバー本体を含めない** (AGPL 感染回避)。GTO Wizard 出力の数値データは
  事実情報として扱い、表示のみ提供。
- 元データの取得方法は規約に従うこと。本リポジトリの公開先 URL を不特定多数に
  共有しない (Access ゲート推奨)。

## ドキュメント

| ファイル | 内容 |
|---|---|
| `docs/SCHEMA.md` | Preflop データ JSON の厳密仕様 (v1.2.0) |
| `docs/DECISIONS.md` | 設計判断と将来計画 |
| `docs/FLOP_STRATEGY_TAB.md` | Flop タブ全体設計レポート (Phase 0-8 通史) |
| `docs/PHASE2_DESIGN.md` | Flop コンポーネント構造図 + データフロー |
| `docs/FLOP_UX_SPEC.md` | Flop UX 詳細仕様 (画面構成、インタラクション) |
| `docs/R2_SETUP_GUIDE.md` | R2 セットアップ手順 (rclone, CORS, env vars) |
| `docs/DEPLOY.md` | デプロイ手順 (Cloudflare Pages + R2) |
| `docs/PREFLOP_TREE.md` | Preflop ツリーの仕様 |

## ファイル構造 (抜粋)

```
src/
├── App.tsx                              # ルート (preflop + flop タブ切替)
├── components/
│   ├── DualRangeView.tsx                # preflop 左右ペイン + 「Flop に進む」ボタン
│   ├── HandMatrix.tsx / HandCell.tsx
│   ├── HandDetail.tsx / AggregateReport.tsx
│   ├── ScenarioSelector.tsx / Breadcrumb.tsx
│   ├── ActionButton.tsx
│   ├── HandInput.tsx / HandKeyboard.tsx
│   ├── OpenStrategyTable.tsx
│   ├── ThreebetStrategyTable.tsx
│   ├── FourbetStrategyTable.tsx
│   ├── EvRankDisplay.tsx
│   ├── TopTabs.tsx                      # Phase 5: PC 用上部タブ (Preflop / Flop)
│   ├── FlopStrategyView.tsx             # Phase 4-6: Flop タブ container
│   ├── FlopVariantSelector.tsx          # opener × responder × pot 深度
│   ├── FlopBreadcrumb.tsx
│   ├── FlopBoardSummary.tsx             # OOP/IP/EV/EQR + 大カード
│   ├── FlopActionTotalsCard.tsx         # 背景グラデ + 集計記号
│   ├── FlopNextActionButtons.tsx        # 実行ボタン (0% 非表示)
│   ├── FlopBoardInput.tsx               # 「フロップを指定」開閉
│   ├── FlopKeyboard.tsx                 # 13×4 カードグリッド
│   ├── FlopBoardList.tsx                # 1755 boards 折りたたみ
│   └── mobile/
│       ├── MobileApp.tsx                # Range / Eval / Flop 3 タブ (Phase 7 で拡張)
│       ├── TabSwitcher.tsx              # 3 タブ化
│       ├── MobileFlopView.tsx           # Phase 7: PC データ共有、UI ラッパー
│       └── ...
├── data/
│   ├── scenarios.ts                     # preflop ノードパスヘルパー
│   ├── availableNodes.ts                # AUTO-GENERATED 128ノード manifest
│   ├── nodeMeta.ts                      # AUTO-GENERATED action_history meta
│   ├── evRanking.ts                     # AUTO-GENERATED ティア lookup
│   ├── flopVariantsManifest.ts          # AUTO-GENERATED 45 variants
│   ├── flopVariants.ts                  # getPotDepth / opener / caller / responder / preflop→flop
│   ├── flopChain.ts                     # chain ↔ filename + encodeStep + hasAggressionInChain
│   └── flopBoardMap.ts                  # iso signature → 正準 board の lazy singleton
├── hooks/
│   ├── useStrategy.ts                   # preflop fetch
│   ├── useOpenEvaluation.ts
│   ├── use3betEvaluation.ts
│   ├── use4betEvaluation.ts
│   ├── useViewportMode.ts
│   └── useFlopNode.ts                   # Phase 3: flop fetch (variant + chain)
├── utils/
│   ├── normalize.ts                     # raw JSON → StrategyData
│   ├── handNotation.ts
│   ├── strategySymbol.ts                # classifyByPlayRate / buildGradient / STRATEGY_TEXT_COLORS
│   ├── openEvaluation.ts
│   ├── evTier.ts
│   ├── hands.ts
│   └── flopBoardCanonical.ts            # Phase 3: スート同型 iso signature
├── styles/theme.ts
└── types/
    ├── strategy.ts
    ├── card.ts
    ├── mobile.ts
    └── flop.ts                          # Phase 1: FlopNode 型定義

public/
├── _headers
└── data/
    ├── preflop/cash_100bb_6max_nl500_2.5x/  # 128 JSON
    └── ev_ranking/utg_open_ev_100bb.json

data/                                      # gitignored, R2 origin (1.6 GB)
└── cash_100bb_6max_nl500_2.5x/<variant>/flop_*.json
```
