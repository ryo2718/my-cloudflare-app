# Flop Strategy タブ 設計レポート

> **STATUS** (2026-05-12 時点): **Phase 0 〜 8 すべて完了 ✅**
> 8 component / 6 phase の実装が完了し、PC + Mobile 両方で Flop タブが動作。
> - Phase 0: 配信基盤 (R2 + gitignore + docs)
> - Phase 1: 型定義 (`src/types/flop.ts`)
> - Phase 2: 土台コード (manifest 生成 / chain / variants helpers / TopTabs スタブ)
> - Phase 3: fetch hook + iso 抽象化 (`useFlopNode` / `flopBoardCanonical` / `flopBoardMap`)
> - Phase 4: 8 UI コンポーネント (selector / breadcrumb / summary / actions / inputs / list)
> - Phase 5: 正式タブ化 (TopTabs 配線、`activeTab` state)
> - Phase 6: preflop → flop 連携 (`getDefaultFlopVariantFromPreflopNode` + 「Flop に進む」ボタン)
> - Phase 7: Mobile (`MobileFlopView` + 3 タブ TabSwitcher)
> - Phase 8: 仕上げ (lint 9 件 → 0 件、docs 更新、DEPLOY 手順)

現在 pokergtoapp は Preflop only の SPA。
これに「Flop Strategy」タブを追加するにあたり、**今手元にある情報** を整理する。

---

## 1. 既存アプリの現状

### 1.1 構成
- React 19 + Vite 8 + TypeScript (router 不使用、内部 state のみ)
- Cloudflare Pages 配信 (`dist/` を deploy)
- 単一 View: **Preflop Strategy Viewer (dual-pane)**
  - 左 = opener の現ノード、右 = responder の現ノード
  - `App.tsx` の `leftNodePath` / `rightNodePath` / `breadcrumb` で全状態を保持
  - tab 概念は **PC 側に存在しない**

### 1.2 既存タブ UI (Mobile のみ)
- `src/components/mobile/TabSwitcher.tsx`: 2タブ (`range` / `eval`)
- 茶系テーマ、underline-active 形式 (`#b45309` border-bottom)
- PC 用に流用する場合はそのまま参考にできる

### 1.3 データ層
- 既存 preflop: `public/data/preflop/cash_100bb_6max_nl500_2.5x/<node_path>.json`
  - 128 ファイル / 計 **1.2 MB** / 1ファイル平均 ~10 KB
  - `App.tsx` の `useEffect` で **起動時に全件バックグラウンド prefetch** (`loadAllOpenNodes` / `loadAll3betNodes` / `loadAll4betNodes`)
  - 個別表示は `useStrategy(scenario)` フックで `fetch(scenario.path)` する
  - `_headers`: `/data/preflop/*` は `max-age=86400, immutable`
- JSON 構造: `game_info` (active/folded/action_history) + `hands{XX:{action:freq}}` の 169 ハンド分

### 1.4 ノード/シナリオ抽象
- `src/data/scenarios.ts`:
  - `getNodeScenario(nodePath)` で任意 path → `Scenario {id, label, path, hero, villain, category}` を生成
  - 末尾セグメントが hero (例: `utgr_bbr_utgc` → hero=UTG)
  - category は `'rfi' | 'vs_rfi'` の二択しか持っていない (拡張余地ありというコメントは scenarios.ts:6-11 に明記)
- `availableNodes.ts` で manifest 化、`nodeMeta.ts` で表示ラベル

---

## 2. 持ち込んだ Flop データ (現状)

### 2.1 場所
```
/Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x/
```

> **位置付け**: ローカル作業コピー。配信は Cloudflare R2 (§4.1 参照)。
> `.gitignore` で `/data/cash_*/` を除外済 → 1.6 GB が git に流入する事故を防止。

### 2.2 規模
| 指標 | 値 |
|---|---:|
| 総 JSON ファイル数 | **2,686** |
| variant ディレクトリ数 | **45** |
| 総容量 | **1.6 GB** |
| 1 ファイル平均 | ~600 KB (500 KB - 1 MB) |
| boards / ファイル | 1,755 (full deck フロップ展開) |
| 欠損 | 0 (100% 検証済) |

### 2.3 ディレクトリ構造
```
data/cash_100bb_6max_nl500_2.5x/
├── utgr_bbc/                                     ← variant (preflop chain の終端)
│   ├── flop_root.json                            ← フロップ開始 (BB to act)
│   ├── flop_bb_x.json                            ← BB check
│   ├── flop_bb_b1_8.json                         ← BB bet 1.8bb
│   ├── flop_bb_x_utg_b1_8.json                   ← depth 2
│   ├── flop_bb_b1_8_utg_r6_35.json               ← depth 2
│   └── ... (合計 63 ファイル)
├── utgr_bbr_utgc/                                ← 3-bet pot 系
└── ... (合計 45 variants)
```

### 2.4 ファイル命名規則
```
flop_<actor1>_<action1>_<actor2>_<action2>_..._<actorN>_<actionN>.json
```
| 要素 | 例 |
|---|---|
| actor | `bb` `btn` `sb` `utg` `hj` `co` |
| check | `x` |
| call | `c` |
| fold | `f` |
| 1st aggressive | `b<size>` (例 `R1.8` → `b1_8`) |
| re-aggressive | `r<size>` |
| all-in | `bAI` (first) / `rAI` (re-agg) |
| ドット | `_` 置換 (`R6.35` → `r6_35`) |
| root | `flop_root.json` |

### 2.5 JSON 構造 (1ファイル抜粋)
```jsonc
{
  "_meta": {
    "variant": "utgr_bbc",
    "flop_chain": "R1.8",
    "action_chain": ["bb_b1_8"],
    "depth": 1,
    "next_actor": "utg",
    "terminal_type": null,
    "scraped_at": "2026-05-12T..."
  },
  "status": "done",
  "players": [
    {"position": "BB",  "is_hero": false, "relative_position": "OOP"},
    {"position": "UTG", "is_hero": true,  "relative_position": "IP"}
  ],
  "action_totals": [   // ← レンジ平均 (1755 ボード集計)
    {"action_code": "F",     "frequency": 0.178, "solved_action_count": 1755},
    {"action_code": "C",     "frequency": 0.629},
    {"action_code": "R6.35", "frequency": 0.177},
    {"action_code": "R10.9", "frequency": 0.015},
    {"action_code": "RAI",   "frequency": 0.001}
  ],
  "player_totals": [
    {"position": "BB",  "ev": 4.496, "eq": 0.492, "eqr": 1.239},
    {"position": "UTG", "ev": 2.176, "eq": 0.508, "eqr": 0.709}
  ],
  "filtered_action_totals": [...],   // freq < 0.1% カット後の集計
  "filtered_player_totals": [...],
  "filtered_ratio": 1.0,
  "game_point": {                    // 盤面/スタック/可能アクション (UI render 用)
    "game": {
      "current_street": {"type": "FLOP", "start_pot": "5.5", "end_pot": "7.3"},
      "pot": "7.3",
      "active_position": "UTG",
      "board": "QsTs7h",
      "players": [/* 6 seats */]
    },
    "available_actions": [           // 押せるボタンの全仕様
      {"action": {"code":"F","type":"FOLD","display_name":"FOLD",...}},
      {"action": {"code":"C","type":"CALL","betsize":"1.8",...}},
      {"action": {"code":"R6.35","type":"RAISE","betsize_by_pot":"0.5",...}},
      {"action": {"code":"R10.9","betsize_by_pot":"1",...}},
      {"action": {"code":"RAI","allin":true,...}}
    ]
  },
  "solutions": [                     // 各ボード固有の解
    {
      "name": "2h2d2c",              // フロップ 3枚
      "ratio": null,
      "action_solutions": [
        {"action_code":"F","frequency":0.136},
        {"action_code":"C","frequency":0.286},
        {"action_code":"R6.35","frequency":0.380},
        {"action_code":"R10.9","frequency":0.196},
        {"action_code":"RAI","frequency":0.001}
      ],
      "player_solutions": [
        {"position":"BB","ev":null,"eq":null,"eqr":null},
        {"position":"UTG","ev":null,"eq":null,"eqr":null}
      ]
    }
    /* ... 全 1755 ボード分 */
  ]
}
```

### 2.6 全 45 variants と分類
| カテゴリ | variants 数 | files 合計 |
|---|---:|---:|
| SRP (single-raised pot) | 15 | ~1,200 |
| 3-bet pot | 13 | ~700 |
| 4-bet pot | 11 | ~400 |
| 5-bet pot | 2 | 40 |
| limp 系 (SB call) | 4 | ~350 |

(完全一覧は `webscraping/gtowizard/REPORT_FOR_APP_MIGRATION.md` の 230-285 行を参照)

### 2.7 既存 preflop tree との接続
preflop tree の **終端ノード** (e.g. `utgr_bb` → BB が C で応答 → 終端 `utgr_bbc`) が
そのまま flop variant 名 `utgr_bbc` に一致する。
→ preflop の breadcrumb から **連続的に** flop に遷移する UI が技術的に可能。

### 2.8 既知の制約
1. **取得不可 8 ライン** (GTOwizard 側欠損): `hjr_sbr_*` 系や深い 5-bet pot の一部 → variant フォルダ自体が存在しない
2. **showdown ノード取得不可** (API 仕様): `*_rAI_<actor>_c` で終わる chain は無い (が、手前の RAI ノードに F/C 応答頻度あり)
3. **freq < 0.1% の枝はカット** (scraping threshold)

---

## 3. アプリ側で必要になる State 軸

| 軸 | 例 | 値域 |
|---|---|---|
| **A. config** | `cash_100bb_6max_nl500_2.5x` | 現状 1 種のみ (将来追加余地) |
| **B. variant** | `utgr_bbc`, `sbc_bbr3_sbc`, ... | 45 通り |
| **C. flop chain** | `[]`, `["bb_x"]`, `["bb_b1_8", "utg_r6_35"]`, ... | variant 内で 20-126 通り |
| **D. board** (任意) | `2h2d2c`, `AsKsQs`, ... | 1,755 通り |

既存 preflop は (opener × responder + breadcrumb) の 2.5 軸。
Flop は (B, C) 2軸 + 任意で D。**breadcrumb の概念は流用可能**。

---

## 4. 配信戦略 (決定済)

**決定: B (Cloudflare R2 public bucket + custom domain) + path prefix `/v1/`**
理由: 1.6 GB は静的 asset として R2 が正しい置き場。Pages デプロイを軽量に保てる。同 Cloudflare 内で管理一元化、versioning も path prefix で容易。

URL 規約:
```
https://<custom-domain>/data/flop/v1/cash_100bb_6max_nl500_2.5x/<variant>/flop_<chain>.json
```
- `<custom-domain>` はユーザー側で命名 (例: `flop-data.poker-app.example`)。R2 の public bucket に custom domain を割当
- `/v1/` プレフィクスは Q7 (versioning) の決定により最初から導入。再スクレイプ時は `/v2/` に切替
- アプリ側は `VITE_FLOP_DATA_BASE_URL` (例: `https://flop-data.poker-app.example/data/flop/v1/cash_100bb_6max_nl500_2.5x`) 環境変数で base URL を保持する想定 (Phase 3 で導入)

検討した他案 (採用せず):

| 案 | 採否 | 理由 |
|---|---|---|
| A. public/data/flop 直置き | ✗ | dist が 1.6 GB に膨らみ Pages デプロイを圧迫 |
| C. 1 board ごとに分割 | ✗ | 470 万ファイル → 非現実的 |
| D. gzip 化して public に置く | ✗ | 250-400 MB に縮小しても重い、Pages の auto-compress と二重 |
| E. variant index + lazy fetch (public) | ✗ | A と同じ容量問題 |

### 4.1 R2 アップロード手順 (Phase 0)

ユーザー側 (Cloudflare ダッシュボード + CLI) で実施する作業:

**1. R2 bucket 作成**
- Cloudflare ダッシュボード → R2 → Create bucket
- Name: 任意 (例: `pokergtoapp-flop`)
- Location: Automatic
- Public access: 有効化 (custom domain を後で割り当てる)

**2. データアップロード (~1.6 GB / 2,686 ファイル)**

`rclone` 推奨 (並列転送 + 差分対応):
```bash
# rclone で Cloudflare R2 を remote 設定 (初回のみ)
rclone config  # type=s3, provider=Cloudflare, endpoint=https://<account-id>.r2.cloudflarestorage.com

# アップロード (data/cash_<config>/ → R2://<bucket>/data/flop/v1/cash_<config>/)
rclone copy \
  /Users/shirairyouitaru/pokerprojects/pokergtoapp/data/cash_100bb_6max_nl500_2.5x \
  r2:pokergtoapp-flop/data/flop/v1/cash_100bb_6max_nl500_2.5x \
  --transfers=20 --progress
```

`wrangler` でも可 (ただし 1 ファイルずつなので遅い):
```bash
# 単一ファイルテスト用
wrangler r2 object put pokergtoapp-flop/data/flop/v1/cash_100bb_6max_nl500_2.5x/utgr_bbc/flop_root.json \
  --file data/cash_100bb_6max_nl500_2.5x/utgr_bbc/flop_root.json
```

**3. Custom domain 割り当て**
- R2 bucket → Settings → Custom Domains → Connect Domain
- 例: `flop-data.poker-app.example` (利用ドメインの subdomain)
- Cloudflare 側で DNS が自動設定される

**4. CORS 設定**

bucket → Settings → CORS Policy:
```json
[
  {
    "AllowedOrigins": [
      "https://<pages-domain>",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```
`<pages-domain>` は実本番の Pages URL に置換。

**5. 動作確認**
```bash
# 任意ファイルが取得できるか確認
curl -I "https://flop-data.poker-app.example/data/flop/v1/cash_100bb_6max_nl500_2.5x/utgr_bbc/flop_root.json"
# 200 OK + Content-Type: application/json + CF-Cache-Status を確認
```

**6. アプリ側設定**
- `.env.local` (gitignore 済) に `VITE_FLOP_DATA_BASE_URL=https://flop-data.poker-app.example/data/flop/v1/cash_100bb_6max_nl500_2.5x` を記述
- Cloudflare Pages の環境変数にも同名で本番値を登録
- アプリは `import.meta.env.VITE_FLOP_DATA_BASE_URL` で参照 (Phase 3 で配線)

---

## 5. UX 案 (たたき台)

### 5.1 ナビゲーション
ヘッダに 2 タブ追加:
```
[ Preflop ]  [ Flop ]
```
PC は Preflop の DualRangeView の上 (ScenarioSelector の上) に配置。
Mobile は既存 TabSwitcher を 3 タブ (`range` / `eval` / `flop`) に拡張、もしくは PC と同じ上部タブ。

### 5.2 Flop タブの内部 View 案 (たたき台2つ)

**案 X: 1 行 1 chain ノード型 (treemap 風)**
- 上部: variant セレクタ (45 個から選択。`utgr_bbc` "UTG → BB call SRP" 等の人間可読ラベル)
- 中央: 現在のノードの `action_totals` を棒グラフ + 数値で表示
- 下部: クリック可能な next-action ボタン (`game_point.available_actions` から render) → 次ノードへ遷移
- Breadcrumb: 既存 `Breadcrumb` を流用

**案 Y: マトリクスベース (ボード × アクション)**
- 上部: variant + chain (案 X と同じ)
- メイン: 1,755 ボードをグリッド表示、各セルに最大頻度アクションを色分け
- セルクリック → そのボードの `action_solutions` をモーダル表示

→ **案 X 推奨** (実装コスト軽 / 既存 Breadcrumb 流用可 / preflop と一貫したナビゲーション)。
案 Y は v2 で追加検討。

### 5.3 Preflop ↔ Flop 接続フロー (v1 で実装、Q5 決定)
preflop tree の終端 (e.g. `utgr_bb` で BB が Call) に到達 → 「Flop に進む」ボタン
→ Flop タブに切替 + variant 自動セット (`utgr_bbc`) + chain は root から開始

実装コスト: preflop 終端ノード名 = flop variant 名 (末尾に最終アクション識別子を付加) のため、変換は数行で済む。学習ツールとして preflop → flop の流れが核心的価値、独立タブだとこの体験が失われるため v1 で投入。

---

## 6. 実装ステップ (Q1-Q7 確定後の版)

| Phase | スコープ | 内容 | ファイル目安 |
|---|---|---|---|
| **0. 配信基盤** | v1 | `.gitignore` で flop データ保護、R2 アップロード手順 doc 化、Open Questions 決定の反映 (本ドキュメント) | `.gitignore`, `docs/FLOP_STRATEGY_TAB.md` |
| **1. 型定義** | v1 | flop JSON の型 (`FlopNode`, `ActionTotal`, `BoardSolution`, `GamePoint`, `PlayerTotal`) | `src/types/flop.ts` |
| **2. ヘルパー** | v1 | `chain_to_filename` の TS 移植、variant manifest (45 種)、ラベル変換、ポット深度分類 | `src/data/flopScenarios.ts` |
| **3. データ取得 hook** | v1 | `useFlopNode(variant, chain): { data, loading, error }` — R2 base URL から on-demand fetch (prefetch なし)。`VITE_FLOP_DATA_BASE_URL` 経由 | `src/hooks/useFlopNode.ts` |
| **4. View コンポーネント** | v1 | `<FlopStrategyView>`: variant + ポット深度セレクタ + breadcrumb + `action_totals` + next-action ボタン (single-pane, Q6) + Board 折りたたみ list (Q4) | `src/components/FlopStrategyView.tsx`, `src/components/FlopBoardList.tsx` |
| **5. タブ追加** | v1 | App.tsx に `activeTab: 'preflop' \| 'flop'` を追加、上部 underline tab (Mobile TabSwitcher を PC に流用, Q2) | `src/App.tsx`, `src/components/TopTabs.tsx` |
| **6. Preflop ↔ Flop 連携** | **v1 (Q5 で v1.1 から格上げ)** | preflop 終端ノードに「Flop に進む」ボタンを追加。clicked → flop タブ切替 + variant 自動セット | `src/App.tsx`, `src/data/scenarios.ts` |
| **7. Mobile 対応** | v1 | MobileApp の TabSwitcher を 3 タブ化 (`range` / `eval` / `flop`)、FlopStrategyView の mobile レイアウト | `src/components/mobile/MobileApp.tsx`, `TabSwitcher.tsx` |
| **8. board detail** | v2 | 個別 board のクリック詳細 (heatmap / モーダル) | 追加コンポーネント |

**全 phase で死守**: 既存 preflop 機能を壊さない / 既存 44 テストを維持。各 Phase 完了後に `npm test` で確認。

---

## 7. Open Questions (確定済 / 2026-05-12)

1. **配信方針**: 4 章のどれを採るか (容量との trade-off)。Cloudflare Pages の per-project サイズ上限を要確認。
   - **決定: B (Cloudflare R2 public bucket + custom domain)**。`/v1/` プレフィクスで versioning。詳細は §4 / §4.1。
2. **タブ UI の置き場**: PC でも mobile と同じ underline-tab を上部に出すか、別形式 (segmented control / sidebar) か。
   - **決定: 上部 underline tab**。既存 `src/components/mobile/TabSwitcher.tsx` を PC でも流用 (router 追加なし)。
3. **variant selector の見せ方**: 45 個を一覧 (フラット dropdown)？ それとも opener × カテゴリ (SRP / 3bp / 4bp / 5bp / limp) の階層ピッカー？
   - **決定: 既存 ScenarioSelector (opener + responder) + ポット深度セレクタ (SRP / 3bp / 4bp / 5bp / limp)**。preflop と同じ操作感、3 操作以内で 45 variants から絞り込み可能。
4. **board view**: v1 で board ごとの細かい表示は出すか、`action_totals` (レンジ平均) だけで MVP とするか。
   - **決定: レンジ平均 (`action_totals`) をメイン表示 + 「Board 一覧」折りたたみ panel (シンプル list)**。同一 fetch で全 1,755 ボードが手元に来るため非表示は不経済。heatmap 等は v2。
5. **既存 preflop の breadcrumb との一体化**: タブ切替で reset するか、preflop 終端から flop に「continue」する遷移ロジックを v1 で入れるか。
   - **決定: v1 から実装** (Claude Code 推奨の v1.1 を上書き)。preflop 終端ノード名 = flop variant 名のため変換は数行で済む。学習ツールとして preflop → flop の流れが核心的価値、独立タブだと体験が失われるため v1 投入。
6. **Hero 視点の切替**: flop は OOP/IP 両方の戦略を同 JSON が含む (`player_totals`) → preflop の "dual-pane" 形式を流用するか、単一 view にするか。
   - **決定: single-pane (現ノードの strategy を中央に表示、`player_totals` で両プレイヤーの EV/EQ/EQR は併記)**。flop データは「1 ノード = 次の 1 actor の決定」が単位、dual にすると不自然な並列表示になる。
7. **データ更新運用**: flop 側の再スクレイプはどの頻度？ 配信側の immutable cache を破棄する versioning 戦略 (e.g. `/data/flop/v1/...`) を最初から仕込むか。
   - **決定: 最初から `/data/flop/v1/cash_100bb_6max_nl500_2.5x/...` で開始**。immutable header を破棄するには URL 変更しかなく、後付けより最初に入れる方が安い。再スクレイプ時は `/v2/` を新設して切替。

---

## 8. すぐ参照できる関連ファイル

| パス | 内容 |
|---|---|
| `data/cash_100bb_6max_nl500_2.5x/<variant>/flop_*.json` | flop 全データのローカル作業コピー (1.6 GB, gitignore 済, R2 から配信予定) |
| `webscraping/gtowizard/REPORT_FOR_APP_MIGRATION.md` | 元データ仕様の full レポート (300 行) — JSON 構造 / chain→file ヘルパー / 45 variants 一覧 |
| `webscraping/gtowizard/REPORT_TREE_COMPLETENESS.md` | 完全性検証ログ |
| `src/App.tsx` | 既存 Preflop View のエントリ (tab 追加箇所) |
| `src/data/scenarios.ts` | preflop ノード抽象 (拡張余地のコメントあり, L6-11) |
| `src/hooks/useStrategy.ts` | fetch + state パターン (flop でも同形で書ける) |
| `src/components/mobile/TabSwitcher.tsx` | 流用可能な tab UI |
| `public/_headers` | Cloudflare キャッシュ設定 (flop 用ルールを追加する場所) |
| `docs/PREFLOP_TREE.md` | preflop ツリー設計の既存ドキュメント (体裁の参考) |
| `docs/SCHEMA.md` | preflop データスキーマ (flop も同様の SCHEMA.md を増やすか追記するか) |
