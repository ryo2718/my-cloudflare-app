# Flop タブ UX 仕様書

> **IMPLEMENTATION STATUS** (2026-05-12 時点): **§1〜§7 確定仕様すべて実装完了 ✅**
> §8 の 4 未確定事項も推奨案で確定済 (詳細は §8 内に記載)。
> 個別の sub-feature 状況:
> - Flop 入力 (§2.1): `FlopKeyboard.tsx` + `FlopBoardInput.tsx` で実装 (専用ボタン開閉)
> - Position 選択 (§2.2): `FlopVariantSelector.tsx` の opener × responder + SB-only Open/Limp トグル
> - Pot 深度 (§2.3): 同 selector の Pot Depth segmented control
> - Board 概要 (§2.4): `FlopBoardSummary.tsx`、Visual ⇄ Numeric トグルで EQ ゲージ化
> - アクション一覧 (§2.5): `FlopNextActionButtons.tsx`、0% は完全非表示 (Phase 6 で完全 fix)
> - Breadcrumb (§2.6): `FlopBreadcrumb.tsx`、Reset ボタン併置
> - Board list (§2.8): `FlopBoardList.tsx`、1755 行 単純 div、`react-window` 不要 (実測 < 1ms)
> - Preflop → Flop 連携: `DualRangeView` の「Flop に進む」ボタン (Phase 6)
> - Mobile: `MobileFlopView.tsx` で PC コンポーネント再利用 (Phase 7)

本ドキュメントは Flop タブの **画面構成・インタラクション・視覚表現の確定仕様** を集約する。Phase 4 (View 実装) / Phase 7 (Mobile) の実装は本仕様に従う。技術設計 (props・state・ファイル構成) は `PHASE2_DESIGN.md` を参照。

---

## 1. 全体構成 (PC)

画面を上から順に:

```
┌────────────────────────────────────────────────────────┐
│  [Preflop]  [Flop]                       ← TopTabs    │
├────────────────────────────────────────────────────────┤
│  Flop タブのコンテンツ:                                  │
│                                                        │
│  ① Flop 入力 (任意): 13×4 カードグリッド (3 枚選択)        │
│                                                        │
│  ② Position 選択: Opener × Responder                   │
│      └─ 自動 OOP/IP 判定                                │
│                                                        │
│  ③ Preflop シナリオ: limp / SRP / 3bp / 4bp / 5bp        │
│      └─ 各組合せで isAvailableFlopVariant() 判定          │
│                                                        │
│  ④ Breadcrumb (chain navigation)                       │
│                                                        │
│  ⑤ ボード概要:                                          │
│      OOP: BB    EV: 4.50    EQR: 1.24                  │
│      IP : UTG   EV: 2.18    EQR: 0.71                  │
│      Flop: [Q♠] [T♠] [7♥]    ← 大きめ表示                │
│                                                        │
│  ⑥ アクション一覧 (現ノード = 次に動く actor の選択肢):    │
│      ◎  Bet 25%      63%   [→ 実行]                    │
│      ○  Bet 75%      18%   [→ 実行]                    │
│      ✕  Check        18%   [→ 実行]                    │
│      ※ 0% アクションは非表示                              │
│                                                        │
│  ⑦ 戻る / リセットバー                                    │
│                                                        │
│  ⑧ Board 一覧 (折りたたみ): 1,755 boards                 │
└────────────────────────────────────────────────────────┘
```

---

## 2. UI 詳細仕様

### 2-1. Flop 入力 (`<FlopBoardInput>`)

- **13×4 カードグリッド** (13 ランク行 × 4 スート列)
- スートごとに色 (既存 `SUIT_COLOR` from types/card.ts 流用):
  - ♠ `#9ca3af` (gray)
  - ♥ `#dc2626` (red)
  - ♦ `#2563eb` (blue)
  - ♣ `#16a34a` (green)
- 3 枚選択で確定 (`onComplete(board: string)` 発火)
- 選択済みカードは `disabled` (= クリック不可、視覚的にグレーアウト)
- リセットボタンで全選択解除
- 入力中は「現在 N/3 枚選択」と表示

実装は **既存 `HandKeyboard.tsx` のスタイル/Key コンポーネントは流用するが、コンポーネント自体は別ファイル `FlopKeyboard.tsx` として新設** (理由: HandKeyboard を flop 用に拡張すると既存テストとの整合性が複雑化)。

入力後の動作: 入力したフロップを `flopBoardCanonical` (Phase 3) で正準化し、現在の `data.solutions[]` 中の該当 board に scroll / highlight。

### 2-2. Position 選択 (`<FlopPositionPicker>`)

- 2 人選択 UI (preflop の `ScenarioSelector` を流用)
- 入力: opener, responder
- 自動判定: postflop OOP/IP は seat 順 (`SB > BB > UTG > HJ > CO > BTN`) から導出
  - 例: UTG vs BB → BB = OOP, UTG = IP
  - 例: CO vs BTN → CO = OOP, BTN = IP
- **opener の選択肢**: 5 種 (UTG/HJ/CO/BTN/SB) — BB はオープンできない
- **responder の選択肢**: opener より後ろの席のみ (`getValidResponders(opener)`)
- **特例**: opener=SB の場合、`'open'` と `'limp'` の 2 アクション選択肢を追加表示 (既存 mobile `DualPositionPicker` の `OpenerAction` パターン)

### 2-3. Preflop シナリオ (`<PotDepthSelector>`)

- ピル形式の 5 ボタン: `[Limp] [SRP] [3bp] [4bp] [5bp]`
- 各ボタンの enable / disable は **`(opener, responder, potDepth)` の組合せで対応する flop variant が `FLOP_VARIANTS` にあるか** で決まる
- 存在しない組合せは disabled (グレーアウト + tooltip "データなし")
- 例: opener=HJ, responder=SB, potDepth=4bp → `hjr_sbr_hjr<size>_sbc` の variant がデータセットに存在しないので disabled
- 例: opener=SB, action=limp → `Limp` のみ enable、他は disable または別系統に切替

### 2-4. ボード概要 (`<FlopBoardSummary>`)

```
┌──────────────────────────────────────────────────┐
│ OOP: BB     EV: 4.50    EQ: 49.2%   EQR: 1.24   │
│ IP : UTG    EV: 2.18    EQ: 50.8%   EQR: 0.71   │
│                                                  │
│        ┌────┐  ┌────┐  ┌────┐                   │
│        │ Q  │  │ T  │  │ 7  │                   │
│        │ ♠  │  │ ♠  │  │ ♥  │                   │
│        └────┘  └────┘  └────┘                   │
│                                                  │
│ Pot: 5.5bb → 7.3bb     Active: UTG              │
└──────────────────────────────────────────────────┘
```

- **OOP/IP ラベル + EV + EQ + EQR**: `FlopNode.player_totals[]` から取得、整形済表示
- **Flop カード大きめ**: `FlopNode.game_point.game.board` を 3 枚パース、それぞれ 60×80px 程度
- スート色は `SUIT_COLOR`
- **タップで切替**: 数字表示 ⇄ ゲージ可視化 (例: EQ をバー表示)
- Pot 情報: `current_street.start_pot` → `end_pot`、`active_position`

### 2-5. アクション一覧 (`<FlopNextActionButtons>`)

各アクション 1 行レイアウト:

```
┌───┬─────────────┬────────┬─────────────┐
│ ◎ │  Bet 25%    │  63%   │  [→ 実行]   │
└───┴─────────────┴────────┴─────────────┘
```

- **記号 (左)**: `classifyByPlayRate(WithAllin)` で ◎/○/△/✕ を導出 → 個別 action の頻度から評価
  - frequency ≥ 90% → ◎、≥ 30% → ○、≥ 10% → △、else ✕
- **アクションラベル (中央左)**: 既定の表記規約 (§4 参照)
- **頻度 (中央右)**: `action_totals[i].frequency * 100` を整数 % 表示
- **実行ボタン (右)**: クリックで chain.push(encodeStep(...))、即遷移 (確認モーダルなし)
- **行の文字色**: action_type に応じて既存 `STRATEGY_TEXT_COLORS`:
  - check → `STRATEGY_TEXT_COLORS.call` 緑
  - bet/raise → `STRATEGY_TEXT_COLORS.raise` 赤
  - all-in → `STRATEGY_TEXT_COLORS.allin` 紫
  - fold → `STRATEGY_TEXT_COLORS.fold` 青
  - call → `STRATEGY_TEXT_COLORS.call` 緑
- **0% は非表示**: `action_totals[i].frequency === 0` の行は描画しない
- **背景グラデ (タブ全体)**: `FlopActionTotalsCard` 内で `buildGradient` / `buildGradientWithAllin` を使用

### 2-6. Breadcrumb (`<FlopBreadcrumb>`)

- 既存 `Breadcrumb` (PC) を流用
- 各 entry のラベル形式: `"<Actor> <ActionLabel>"`
  - `"BB Bet 25%"`、`"UTG Raise 50%"`、`"BB Call"`、`"UTG All-in"`
- HOME entry: variant 名 → `"<Opener>r → <Caller>c (SRP)"` 風に整形
- クリックでその位置まで `chain` を truncate

### 2-7. 戻る / リセットバー (`<FlopBackResetBar>`)

```
[← 戻る]                          [↻ リセット]
```

- **戻るボタン**: chain の末尾 1 個を pop (`chain.slice(0, -1)`)
- **リセットボタン**: chain = `[]` にする、**variant は維持**
- 両方とも chain.length === 0 で disabled

### 2-8. Board 一覧 (`<FlopBoardList>`)

折りたたみ状態がデフォルト:

```
▼ Board 別解 (1,755)
   ┌──────────────────────────────────────────────┐
   │ A♥ K♥ Q♥   ◎ Bet 75% 87%                    │
   │ A♥ K♥ Q♦   ○ Bet 25% 52%   △ Check 38%      │
   │ A♥ K♣ Q♦   ○ Check 65%                       │
   │ ...                                          │
   └──────────────────────────────────────────────┘
```

- 各行: **ボード名 (♠♥♦♣ 色付き)** + 主要アクション 1-2 個 (頻度上位 2 つを `action_solutions[]` から抽出)
- v1 はシンプル list、ヒートマップは v2
- 1,755 行を扱うので **仮想スクロール検討** (Phase 4 着手時に react-window 採用判定)
- クリックでそのボードを Flop 入力欄に sync (`setBoardInput(name)`)

---

## 3. インタラクション

### 3-1. 実行ボタン
- 即遷移 (確認モーダルなし)
- chain に新ステップを push、再 fetch される (再 fetch は `useFlopNode` の依存配列で自動)

### 3-2. パンくず
- クリックでその位置に戻る (chain truncate)
- HOME (variant 名) クリックで chain = `[]`

### 3-3. 戻るボタン
- chain.pop() — 1 つ前のノードへ
- chain.length === 0 で disabled

### 3-4. リセットボタン
- chain = `[]`、variant は維持
- Position / Pot 深度の選択もそのまま

### 3-5. Variant 切替
- chain は自動 reset
- boardInput も reset
- breadcrumb HOME のみ

---

## 4. ベットサイズ表記 (UI 出力規約)

| データ層 (`action_code`) | UI 表示 |
|---|---|
| `X` | `Check` |
| `C` | `Call` |
| `F` | `Fold` |
| `R<size>` | `Bet <size%>` (最初の aggressive) / `Raise <size%>` (再 aggressive) |
| `RAI` | `All-in` |

ベットサイズの **pot %** は `FlopAction.betsize_by_pot` 文字列を 100 倍して整数化:
- `betsize_by_pot: "0.25"` → `Bet 25%`
- `betsize_by_pot: "1"` → `Bet 100%` (= pot-sized)
- `betsize_by_pot: "0.5"` → `Bet 50%`
- `betsize_by_pot: null` → fold / call / check (サイズ表記不要)

**「最初の aggressive」と「再 aggressive」の区別**: chain 中に既に `b<size>` / `r<size>` / `bAI` / `rAI` のステップが含まれているかで判定。`encodeStep` の `afterAggression` フラグと同じロジック。

---

## 5. 視覚化 (タップで切替)

各 stat / 比率は **デフォルト = 数値、タップ = ゲージ表示** に切替可。

- 数値表示: `EV: 4.50` / `EQ: 49.2%` / `R: 18%`
- ゲージ表示: 0-1 のバー、塗りつぶし色は既存 `STRATEGY_TEXT_COLORS` の色

切替対象:
- ボード概要の EV / EQ / EQR
- アクション一覧の頻度 %

実装方針 (Phase 4):
- 各 stat に小さなクリック領域を持たせ、`useState` で local display mode を切替
- localStorage に保存しない (= viewport-level の好みなのでセッション限定)

---

## 6. レスポンシブ

### 6-1. PC (`viewportMode === 'pc'`)
- `<FlopStrategyView>` を `<App>` 内 `activeTab === 'flop'` 時に render
- 1280px 以上想定、グリッド 2 列レイアウト可能
  - 左カラム: Position 選択 / Pot 深度 / 戻るリセット
  - 右カラム: ボード概要 / アクション一覧 / Board list

### 6-2. Mobile (`viewportMode === 'mobile'`)
- `<MobileFlopView>` を `<MobileApp>` の `tab === 'flop'` 時に render
- 縦並びシングルカラム、各セクションを縮小
- スワイプで戻る、Board list は collapsed default
- 既存 `MobileApp` のスタイル踏襲 (茶系テーマ、下部 reset ボタン等)

### 6-3. ブレークポイント
- `useViewportMode` の `(max-width: 767px)` をそのまま使用
- 手動切替も既存パターンを尊重

---

## 7. アクセシビリティ・配慮事項

- アクション一覧の **記号 (◎/○/△/✕) は装飾、頻度数値が主**: スクリーンリーダー用に `aria-label` で数値読み上げ
- スート色は **色だけでなく ♠♥♦♣ シンボル併記** (色覚多様性配慮、既存 `SUIT_SYMBOL` で対応済)
- キーボード操作: ボード入力 UI で Tab navigation を保証

---

## 8. 確定済決定事項 (2026-05-12 確定)

1. **タップ切替の対象範囲**
   - **決定: B (ボード概要の EV / EQ / EQR のみ切替可)、理由: 推奨に従う**
   - ゲージの意味があるのは比較対象が複数あるとき (= OOP vs IP の対比)。アクション頻度はすでに色 + 記号で視覚化されており % 数値で十分。Board list の各行はテキストが読みやすい。Phase 4 着手時に実装感覚で再判断する余地はある。
   - **実装 Phase**: Phase 4

2. **Board list の v1 表示密度**
   - **決定: B (主要アクション 2 個 = 頻度上位 2 つを表示)、理由: 推奨に従う**
   - 1 個だと board の特徴 (e.g. 「ほぼ Bet だが Check も少しある」) を捉えられず、3+ は行が長くなりスキャン困難。2 個なら 90% 以上のケースで合計頻度 > 80% をカバー。詳細表示は board クリックの v2 機能で。
   - **実装 Phase**: Phase 4

3. **5bp variants の特例ラベル**
   - **決定: A (Pot 深度セレクタの通常ボタンとして出す、多くの組合せで disabled)、理由: 推奨に従う**
   - 既存「データが無い組合せは disabled で表示」パターン (preflop の `getValidResponders` と同じ思想) に従う。例外を作ると UI ロジックが複雑化。5bp の「2 種しか存在しない」事実自体が学習価値あり。
   - **実装 Phase**: Phase 4

4. **板入力 UI の起動方法**
   - **決定: A (専用ボタン「フロップを指定」押下で開閉、§8 と統合)、理由: 推奨に従う**
   - 起動方法は配置と本来一体。`PHASE2_DESIGN.md §9 - 3` で配置を C (専用ボタン) と確定したので、起動も同じボタンで自然。
   - **実装 Phase**: Phase 4
