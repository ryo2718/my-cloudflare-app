# Preflop Strategy Viewer

ポーカー (NLHE 6max, 100bb キャッシュ) のプリフロップ GTO 戦略を、169ハンドマトリクスと
ハンド単体評価で確認するための React + Vite 製のクライアント完結型 Web アプリ。

## できること

- **DualRangeView** — Opener と Responder のレンジを 13×13 マトリクスで左右並列表示
  - Raise / All-in ボタンで深いノード (3bet, 4bet, 5bet, AI) に潜行
  - Breadcrumb (`Home › UTG open (2.5bb) › BB 3bet (12bb) › ...`) で履歴と巻き戻し
- **Hand Evaluator** (画面下部、details で展開)
  - `HandInput`: combo (`AhKs`) と 169 表記 (`AKs`) どちらでも入力可、スクリーン+物理キーボード両対応
  - `OpenStrategyTable`: 5ポジション (UTG/HJ/CO/BTN/SB) の Open 戦略を ◎○🔼❌ で評価
  - `EvRankDisplay`: SB オープン EV 基準のティア (プレミアム / エリート / ... / トラッシュ) と上位%
  - `ThreebetStrategyTable`: vs ポジション別タブで 3bet/call (play率) を評価

## 技術スタック

- TypeScript + React 19 + Vite 8
- スタイリング: インライン style + 中央集約 `src/styles/theme.ts` (ベージュ&クリームテーマ)
- データ: 静的 JSON、`fetch()` で取得 + モジュールスコープ in-memory cache
- ビルド時に静的同梱: 169ハンド × ティア lookup (`src/data/evRanking.ts`),
  全128ノードの reach メタ (`src/data/nodeMeta.ts`), 利用可能ノード manifest (`src/data/availableNodes.ts`)
- ルーティング: なし (シングルページ)
- バックエンド: なし (完全静的)

## 開発

```bash
npm install
npm run dev            # http://localhost:5173/
npm run build          # tsc -b && vite build → dist/
npm run preview        # http://localhost:4173/ で dist/ をプレビュー
npm run lint
```

### データ生成スクリプト (再生成時のみ)

```bash
# EVランクを ev_data.json から再生成
node scripts/build-ev-tiers.cjs

# 全ノードの action_history メタを再抽出 (Breadcrumb ラベル用)
node scripts/generate-node-meta.cjs
```

## データ仕様

- ソルバー: GTO Wizard (Cash 100bb 6max NL500 General 2.5x preset)
- 配置: `public/data/preflop/cash_100bb_6max_nl500_2.5x/<node_path>.json` (128ファイル)
- スキーマ: `docs/SCHEMA.md` (v1.2.0、sparse 形式)
  - 4アクション固定 (`fold` / `call` / `raise` / `allin`)、確率は 0–100 (%)
  - 不到達ハンドはキー省略 (sparse)
- node_path 命名: `<actor1><action_suffix>_<actor2>...` (例: `cor_btnr_co` = CO open → BTN 3bet → CO 判断)
  - suffix: `r` = raise, `c` = call, `ai` = all-in
- EV データ: `public/data/ev_ranking/utg_open_ev_100bb.json` (169ハンド × `{combo, ev}`)

## デプロイ

### Cloudflare Pages

ビルド設定:
- ビルドコマンド: `npm run build`
- 出力ディレクトリ: `dist`
- Node バージョン: 20+ (推奨)

`public/_headers` で:
- セキュリティヘッダ (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- 静的データ (`/data/preflop/*`, `/data/ev_ranking/*`) に Cache-Control 24h
- ビルド成果物 (`/assets/*`) に Cache-Control 1年 (immutable)

`public/_redirects` で SPA fallback (`/* /index.html 200`)。

### アクセス制限 (任意)

Cloudflare Zero Trust (Access) を Pages サイトに被せると、メール OTP 等で
許可ユーザーのみ閲覧可能にできる。プライベート利用前提なら推奨。

## ライセンス・法的観点

- 本リポジトリには**ソルバー本体を含めない** (AGPL 感染回避)。GTO Wizard 出力の数値データは
  事実情報として扱い、表示のみ提供。
- 元データの取得方法は規約に従うこと。本リポジトリの公開先 URL を不特定多数に
  共有しない (Access ゲート推奨)。

## ドキュメント

- `docs/SCHEMA.md` — データ JSON の厳密仕様 (v1.2.0)
- `docs/DECISIONS.md` — 設計判断と将来計画
- `docs/README.md` — 引継ぎ向け詳細ガイド (Claude Code 連携)

## ファイル構造 (抜粋)

```
src/
├── App.tsx                          # ルート (state + 試作エリア)
├── components/
│   ├── DualRangeView.tsx            # 左右ペイン
│   ├── HandMatrix.tsx / HandCell.tsx
│   ├── HandDetail.tsx / AggregateReport.tsx
│   ├── ScenarioSelector.tsx / Breadcrumb.tsx
│   ├── ActionButton.tsx
│   ├── HandInput.tsx / HandKeyboard.tsx
│   ├── OpenStrategyTable.tsx
│   ├── ThreebetStrategyTable.tsx
│   └── EvRankDisplay.tsx
├── data/
│   ├── scenarios.ts                 # ノードパスヘルパー
│   ├── availableNodes.ts            # AUTO-GENERATED 128ノード manifest
│   ├── nodeMeta.ts                  # AUTO-GENERATED action_history meta
│   └── evRanking.ts                 # AUTO-GENERATED ティア lookup
├── hooks/
│   ├── useStrategy.ts
│   ├── useOpenEvaluation.ts         # 5ファイル並列+モジュールキャッシュ
│   └── use3betEvaluation.ts         # 15ファイル並列+モジュールキャッシュ
├── utils/
│   ├── normalize.ts                 # raw JSON → StrategyData
│   ├── handNotation.ts              # combo/169 パース
│   ├── openEvaluation.ts            # ◎○🔼❌ 分類
│   ├── evTier.ts                    # 10ティア配色
│   └── hands.ts                     # 169ハンド名生成
├── styles/theme.ts
└── types/
    ├── strategy.ts                  # Position / Hand / Strategy
    └── card.ts                      # Card / HandPair (combo 入力用)

public/
├── _headers                         # Cloudflare Pages 用
├── _redirects                       # SPA fallback
└── data/
    ├── preflop/cash_100bb_6max_nl500_2.5x/  # 128 JSON
    └── ev_ranking/utg_open_ev_100bb.json
```
