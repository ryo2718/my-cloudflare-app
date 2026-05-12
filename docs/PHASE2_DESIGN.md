# Phase 2 設計ドキュメント — Flop Strategy タブ

> **IMPLEMENTATION STATUS** (2026-05-12 時点): **§1〜§7 の全コンポーネント実装完了 ✅**
> 本ドキュメントは Phase 2 着手時の設計図で、Phase 3-7 で実装に落とし込まれた。
> §1 (PC 構造) / §2 (Mobile 構造) は全て実コンポーネントとして存在。
> §6 既存資産マッピング表に挙げた 12 件はすべて再利用済み。
> §7 で書いた Phase 2 土台 6 件 (manifest / variants / chain / TopTabs / 2 テスト) は完成、
> 残り 7 (Mobile Flop) も完了。§8 = board クリック詳細表示は v2 未実装 (将来拡張)。

Phase 2 の成果物は (1) 土台コード (`flopVariants.ts` / `flopChain.ts` / 自動生成スクリプト / `TopTabs` スタブ) と (2) 本ドキュメント (構造設計) と (3) `FLOP_UX_SPEC.md` (UX 詳細仕様)。**コードは Phase 3 以降の hook / view が乗る前提で土台のみ**。

---

## 1. 全体構成 (PC)

```
<App>                                                    [既存]
 ├─ <header>                                              [既存]
 ├─ <TopTabs active={activeTab} onChange=… />             [新規 Phase 2 スタブ → Phase 5 で配線]
 │
 ├─ activeTab === 'preflop'                               [既存をそのまま]
 │   ├─ <ScenarioSelector …/>
 │   ├─ <Breadcrumb …/>
 │   ├─ <DualRangeView …/>
 │   │   └─ "Flop に進む" ボタン (preflop 終端時)           [Phase 6 で追加]
 │   └─ <OpenStrategyTestArea/>
 │
 └─ activeTab === 'flop'                                  [Phase 4 で実装]
     └─ <FlopStrategyView>
         ├─ <FlopVariantSelector />
         ├─ <FlopBoardInput />          (任意、Phase 4)
         ├─ <FlopBreadcrumb />
         ├─ <FlopBoardSummary />        (OOP/IP ラベル + EV + EQR)
         ├─ <FlopActionTotalsCard />    (action_totals メイン表示)
         ├─ <FlopNextActionButtons />   (game_point.available_actions)
         ├─ <FlopBackResetBar />        (戻る / リセット)
         └─ <FlopBoardList collapsed />  (1755 boards 折りたたみ)
```

---

## 2. コンポーネントツリー (Mobile, Phase 7 想定)

```
<MobileApp>                                  [既存]
 └─ <TabSwitcher active=… 3 タブ />          [既存を 3 タブに拡張]
     ├─ tab='range'  → 既存
     ├─ tab='eval'   → 既存
     └─ tab='flop'   → <MobileFlopView>      [Phase 7]
         ├─ <MobileFlopVariantPicker />
         ├─ <MobileFlopBreadcrumb />
         ├─ <MobileFlopSummary />
         ├─ <MobileFlopActionList />          (action_totals + ボタン縦並び)
         └─ <MobileFlopBoardList collapsed />
```

Mobile は Phase 7 で実装するが、データ層 (`useFlopNode`, `flopVariants.ts`, `flopChain.ts`) は PC と完全共有する設計。視覚 UI のみ別。

---

## 3. データフロー

```mermaid
flowchart LR
  U[User input] --> S[App state]
  S -->|variant, chain| FN[chainToFilename]
  FN -->|filename| H[useFlopNode hook]
  H -->|fetch| R[(R2: /data/flop/v1/&lt;config&gt;/&lt;variant&gt;/&lt;file&gt;)]
  R -->|FlopNode JSON| H
  H -->|FlopNode| V[FlopStrategyView]
  V -->|action_totals| AT[FlopActionTotalsCard]
  V -->|available_actions| AB[FlopNextActionButtons]
  V -->|player_totals| PS[FlopBoardSummary]
  V -->|solutions[]| BL[FlopBoardList]
  AB -->|click → encode step| S
```

主要な変換ポイント:
- **state → filename**: `chainToFilename(variant, chain)` — Phase 2 で実装済
- **filename → state**: `filenameToChain(filename)` — Phase 2 で実装済 (deep-link 用)
- **action button click → chain step**: `encodeStep(actor, code, afterAggression)` — Phase 2 で実装済
- **canonicalize board input**: Phase 3 で実装 (`src/utils/flopBoardCanonical.ts`)

---

## 4. 状態管理

### 4-1. App 全体の state
```ts
const [activeTab, setActiveTab] = useState<TopTab>('preflop');  // Phase 5 で追加
```
既存の preflop state (`opener` / `responder` / `leftNodePath` / `rightNodePath` / `breadcrumb`) はそのまま保持し、tab 切替で reset しない。

### 4-2. Flop タブの state
```ts
interface FlopState {
  variant: string;             // 'utgr_bbc' 等、45 種
  chain: string[];             // ['bb_b1_8', 'utg_r6_35'] 等の action_chain
  boardInput: string | null;   // 任意: ユーザーが入力したフロップ "AsKhQd" (Phase 4)
}
```

Reducer 的アクション:
- `selectVariant(variant)` — chain を `[]`, boardInput を null にリセット
- `pushAction(step)` — chain.push(step)
- `popAction()` — chain.pop()
- `truncateChain(length)` — chain.slice(0, length) (breadcrumb)
- `resetChain()` — chain = []、variant は維持
- `setBoardInput(board)` — board canonicalize → solutions[i] index 検索

Mobile 側も同 state を使う想定 (PC と Mobile で共通の `FlopState` reducer、視覚層のみ別)。

---

## 5. コンポーネント責務 & props

### 5-1. `<TopTabs>` ← Phase 2 で実装済 (スタブ)
```ts
type TopTab = 'preflop' | 'flop';
interface Props {
  active: TopTab;
  onChange: (tab: TopTab) => void;
}
```
PC 用 underline tab。Mobile の `TabSwitcher.tsx` のスタイル踏襲、3 タブ化は Mobile 側で別途行う。

### 5-2. `<FlopStrategyView>` (Phase 4)
```ts
interface Props {
  initialVariant?: string;     // preflop → flop 連携時 (Phase 6)
  initialChain?: string[];     // 同上
}
```
内部に `FlopState` を持つ container コンポーネント。Phase 6 の連携時に init prop で受け取る。

### 5-3. `<FlopVariantSelector>` (Phase 4)
```ts
interface Props {
  variant: string;
  onChange: (variant: string) => void;
}
```
- opener (5択) × responder (opener より後ろ) × ポット深度 (limp/SRP/3bp/4bp/5bp) の **3 軸セレクタ**
- 既存 `ScenarioSelector` (opener × responder) + 新規 `<PotDepthSelector>` の組合せで実装
- 各軸を変えるたびに `isAvailableFlopVariant(name)` で組み合わせ実在チェック、無効な組み合わせは disabled

### 5-4. `<FlopBoardSummary>` (Phase 4)
```ts
interface Props {
  data: FlopNode;
}
```
- 上段: `players[]` から OOP/IP ラベルと hero 表示
- 中段: 大きめのカード 3 枚表示 (`game_point.game.board` を ♠♥♦♣ 化、`SUIT_COLOR` 使用) 
- 下段: `player_totals[]` の EV / EQ / EQR を OOP/IP それぞれ表示

### 5-5. `<FlopActionTotalsCard>` (Phase 4)
```ts
interface Props {
  totals: ActionTotal[];        // FlopNode.action_totals
  potDepth: PotDepth;           // background gradient 切替用
}
```
- 既存 `StrategyCard` を流用するか別実装 (集計表示用) — Phase 4 着手時に決定
- `classifyByPlayRate(WithAllin)` で記号 (◎/○/△/✕)
- `buildGradient(WithAllin)` で背景
- `STRATEGY_TEXT_COLORS` で各行の文字色

### 5-6. `<FlopNextActionButtons>` (Phase 4)
```ts
interface Props {
  actions: FlopAvailableAction[];   // FlopNode.game_point.available_actions
  totals: ActionTotal[];            // 頻度を action_code でマッチさせる
  onSelect: (actionCode: string, isAfterAggression: boolean) => void;
}
```
- 各アクションを **記号 + ラベル + % + 実行ボタン** で 1 行表示
- **0% アクションは非表示** (`totals[i].frequency === 0` で filter)
- 0% でも `available_actions` にあるアクションは "有効だが選ばれない" 行として隠す
- 実行ボタンクリック → `onSelect(actionCode, afterAggression)` → 親が `encodeStep` → state.chain にプッシュ

### 5-7. `<FlopBreadcrumb>` (Phase 4)
- 既存 `Breadcrumb` (PC 版) を流用
- entry のラベル例: "BB Bet 25%", "UTG Raise 50%", "BB Call", "All-in"
- クリックで chain truncate

### 5-8. `<FlopBoardList>` (Phase 4)
```ts
interface Props {
  solutions: BoardSolution[];      // 1,755 entries
  selectedBoard?: string;          // 任意、scroll 用
  onSelectBoard?: (name: string) => void;
}
```
- 折りたたみ panel
- 各行: board name (色付き ♠♥♦♣) + 主要アクション 1-2 個 (% 上位)
- 1755 行 → `react-window` 等の仮想スクロール検討 (Phase 4 で要否判定)

---

## 6. 既存資産の使用箇所一覧

| 既存 | Phase 4-7 での使い方 |
|---|---|
| `THEME` (theme.ts) | flop UI 全体のカラーパレット |
| `STRATEGY_TEXT_COLORS` (strategySymbol.ts) | `FlopNextActionButtons` の R/C/AI/F 行色 |
| `buildGradient` / `buildGradientWithAllin` | `FlopActionTotalsCard` の背景 |
| `classifyByPlayRate(WithAllin)` + `getSymbolStyle` | `FlopActionTotalsCard` の記号 |
| `SUIT_COLOR` / `SUIT_SYMBOL` (types/card.ts) | board / flop input のスート色 |
| `Breadcrumb` (PC) | `FlopBreadcrumb` で流用 |
| `useViewportMode` | PC/Mobile 切替 (既存) |
| `OPENER_POSITIONS` / `getValidResponders` | `FlopVariantSelector` |
| `useStrategy` パターン | `useFlopNode` で同形に書く (Phase 3) |
| `StrategyCard` | `FlopActionTotalsCard` で流用検討 (Phase 4 判定) |

---

## 7. Phase 2 で作成した土台ファイル

| ファイル | 内容 | LOC |
|---|---|---:|
| `scripts/generate-flop-manifest.cjs` | `data/cash_*/` から FLOP_VARIANTS を自動生成 | 67 |
| `src/data/flopVariantsManifest.ts` | AUTO-GEN、45 variants の Set + FLOP_CONFIG | 54 |
| `src/data/flopVariants.ts` | 手書き helpers (getPotDepth / opener / caller / preflop→flop) | 124 |
| `src/data/flopChain.ts` | chain ↔ filename + encodeStep | 90 |
| `src/components/TopTabs.tsx` | PC 用 underline tab スタブ (Phase 5 で配線) | 70 |
| `src/data/flopVariants.test.ts` | 28 tests | 110 |
| `src/data/flopChain.test.ts` | 26 tests | 120 |
| `src/types/flop.ts` (Phase 1 既存) | FlopNode 型定義 | 253 |

---

## 8. Phase 3 以降との接続点

| Phase | 必要な追加 | 接続点 |
|---|---|---|
| Phase 3 | `useFlopNode(variant, chain)` hook、 `flopBoardCanonical.ts` | `chainToFilename` を使ってファイル名を組み立て、`VITE_FLOP_DATA_BASE_URL` から fetch |
| Phase 4 | `FlopStrategyView` + 各サブコンポーネント | Phase 1-3 の型 + 本ドキュメントの props 設計 |
| Phase 5 | `<App>` に `activeTab` state 追加、`TopTabs` 配線 | Phase 2 の `TopTabs` をそのまま渡す |
| Phase 6 | preflop 終端 → flop 連携ボタン | `getFlopVariantFromPreflopNode` を呼ぶ、null 時は disabled |
| Phase 7 | Mobile flop view | `flopVariants` / `flopChain` を共有、視覚層のみ別 |

---

## 9. 確定済決定事項 (2026-05-12 確定)

1. **`StrategyCard` を flop で流用するか別実装か**
   - **決定: B (新規 `FlopActionTotalsCard` 作成)、理由: 推奨に従う**
   - preflop と flop で扱う action set が違う (flop には check / bet / 複数サイズ raise の概念がある)。既存 `StrategyCard` を拡張すると preflop 用テスト 44 件への影響リスク発生。ユーティリティ層 (`buildGradient` / `classifyByPlayRate` / `getSymbolStyle` / `STRATEGY_TEXT_COLORS`) は安全に流用、表面 Card 部分のみ新規。
   - **実装 Phase**: Phase 4

2. **`react-window` の導入**
   - **決定: B (素朴 div でレンダリング、必要なら後で換装)、理由: 推奨に従う**
   - 1,755 行は最近のブラウザで素朴 div でも数十 ms で render 可能。Board list はデフォルト折りたたみなのでコスト発生は開いた時のみ。React 19 concurrent rendering も活用できる。Phase 4 完了時に実測し遅延あれば換装 (~50 LOC で対応可能)。
   - **実装 Phase**: Phase 4 (実装)、Phase 4 完了時の実測で換装判定

3. **`FlopBoardInput` の配置**
   - **決定: C (専用ボタン「フロップを指定」で開閉、デフォルト非表示)、理由: 推奨に従う**
   - ユーザー主用途は「レンジ全体ブラウズ」が大半、特定フロップ確認は副用途。デフォルトを cleaner に保ち、必要時のみ展開。Q4 (Board 一覧折りたたみ) と一貫。
   - **実装 Phase**: Phase 4

4. **複数サイズ preflop ノード → flop 連携時の disambiguation UI**
   - **決定: B (デフォルトで最小 size を選び、Flop タブ上で size 切替可)、理由: 推奨に従う**
   - モーダルは流れを切る、preflop breadcrumb からの自動抽出はサイズ表現の不一致で脆い。デフォルト最小で即遷移、Pot 深度セレクタの近くにサイズ切替を出す。該当ケースは 2-3 variants のみで影響範囲限定。
   - **実装 Phase**: Phase 6 (preflop → flop 連携実装時)
